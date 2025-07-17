from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.db.models import Sum
from solicitacao.models import Solicitacao
from devolucao.models import Devolucao
from usuario.models import Funcionario

from PIL import Image
from openpyxl import load_workbook
from openpyxl.drawing.image import Image as ExcelImage

from io import BytesIO
import os
import base64
import copy

# Create your views here.
def template_ficha(request):

    funcionarios = Funcionario.objects.values('id','matricula','nome').order_by('id')

    return render(request, 'ficha.html', {'funcionarios':funcionarios})

def gerar_ficha_epi(request, id):
    try:
        # 1. Obter dados do funcionário
        funcionario = Funcionario.objects.get(id=id)
        
        # 2. Obter solicitações e devoluções
        solicitacoes = Solicitacao.objects.filter(
            funcionario=funcionario,
            status='Entregue'
        ).prefetch_related(
            'dados_solicitacao',
            'dados_solicitacao__dados_solicitacao_devolucao',
            'assinatura'
        ).order_by('data_solicitacao')

        # Criar lista combinada de itens
        itens_planilha = []
        
        for solicitacao in solicitacoes:
            # Para cada DadosSolicitacao na solicitação, criar um item separado
            for dado in solicitacao.dados_solicitacao.all():
                # Adiciona a solicitação (um item por DadosSolicitacao)
                itens_planilha.append({
                    'tipo': 'solicitacao',
                    'objeto': solicitacao,
                    'dado': dado,
                    'data': solicitacao.data_solicitacao
                })
                
                # Adiciona devoluções como itens separados
                for devolucao in dado.dados_solicitacao_devolucao.all():
                    itens_planilha.append({
                        'tipo': 'devolucao',
                        'objeto': devolucao,
                        'dado': dado,
                        'data': devolucao.data_devolucao
                    })

        # Ordena todos os itens por data
        itens_planilha.sort(key=lambda x: x['data'])
        
        # 3. Preparar planilha
        wb = load_workbook('FICHA DE EPI Atualizada.xlsx')
        ws = wb.active
        
        # Preencher cabeçalho
        ws['B4'] = funcionario.nome
        ws['B5'] = funcionario.matricula
        ws['B6'] = funcionario.cargo.nome if funcionario.cargo else ""
        ws['B7'] = funcionario.data_admissao.strftime("%d/%m/%Y") if funcionario.data_admissao else ""
        ws['B8'] = funcionario.setor.nome if funcionario.setor else ""

        # 4. Processar cada item (solicitação ou devolução)
        num_assinaturas = []
        assinatura_fixa = None
        
        for i, item in enumerate(itens_planilha):
            linha_destino = 27 + i
            num_assinaturas.append(i)
            
            # COPIAR FORMATAÇÃO DA LINHA MODELO (27)
            for coluna in range(1, 9):
                fonte = copy.copy(ws.cell(row=27, column=coluna).font)
                preenchimento = copy.copy(ws.cell(row=27, column=coluna).fill)
                borda = copy.copy(ws.cell(row=27, column=coluna).border)
                alinhamento = copy.copy(ws.cell(row=27, column=coluna).alignment)
                
                celula = ws.cell(row=linha_destino, column=coluna)
                celula.font = fonte
                celula.fill = preenchimento
                celula.border = borda
                celula.alignment = alinhamento
            
            ws.row_dimensions[linha_destino].height = ws.row_dimensions[27].height
            
            if item['tipo'] == 'solicitacao':
                solicitacao = item['objeto']
                dado = item['dado']
                
                data_formatada = solicitacao.data_solicitacao.strftime("%d/%m/%Y %H:%M")
                ws.cell(row=linha_destino, column=1).value = data_formatada
                ws.cell(row=linha_destino, column=2).value = dado.quantidade
                ws.cell(row=linha_destino, column=3).value = f"{dado.equipamento.codigo} - {dado.equipamento.nome}"
                ws.cell(row=linha_destino, column=4).value = dado.equipamento.ca
                ws.cell(row=linha_destino, column=6).value = dado.get_motivo_display()
                
                if hasattr(solicitacao, 'assinatura'):
                    try:
                        with solicitacao.assinatura.imagem_assinatura.open('rb') as img_file:
                            image_data = img_file.read()
                        
                        temp_filename = f"assinatura{i}.png"
                        with open(temp_filename, 'wb') as temp_file:
                            temp_file.write(image_data)
                        
                        img = ExcelImage(temp_filename)
                        img.height = 130
                        img.width = 150
                        ws.add_image(img, f'G{linha_destino}')
                        assinatura_fixa = img
                    except Exception as e:
                        print(f"Erro ao processar assinatura: {e}")
            
            elif item['tipo'] == 'devolucao':
                devolucao = item['objeto']
                dado = item['dado']
                
                data_formatada = devolucao.data_devolucao.strftime("%d/%m/%Y %H:%M")
                ws.cell(row=linha_destino, column=2).value = devolucao.quantidade_devolvida
                ws.cell(row=linha_destino, column=3).value = f"{dado.equipamento.codigo} - {dado.equipamento.nome}"
                ws.cell(row=linha_destino, column=4).value = dado.equipamento.ca
                ws.cell(row=linha_destino, column=5).value = data_formatada
                ws.cell(row=linha_destino, column=6).value = 'Devolução'

        # Adicionar assinatura fixa se existir
        if assinatura_fixa:
            ws.add_image(assinatura_fixa, 'B22')
        
        # 5. Salvar e retornar o arquivo
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="Ficha_EPI_{funcionario.nome}.xlsx"'
        wb.save(response)
        wb.close()
        
        # Limpar arquivos temporários
        for num in num_assinaturas:
            if os.path.exists(f"assinatura{num}.png"):
                os.remove(f"assinatura{num}.png")
        if os.path.exists("assinaturaL.png"):
            os.remove("assinaturaL.png")
            
        return response

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def processar_assinatura(base64_string, index):
    """Helper function to process signature images"""
    # Remove prefix if exists
    if isinstance(base64_string, str) and ';base64,' in base64_string:
        base64_string = base64_string.split(';base64,')[1]
    
    image_data = base64.b64decode(base64_string)
    image_buffer = BytesIO(image_data)
    image = Image.open(image_buffer)
    
    # Save temporary file
    temp_filename = f"assinatura{index}.png"
    image.save(temp_filename)
    
    # Create Excel image object
    img = ExcelImage(temp_filename)
    img.height = 130
    img.width = 150
    
    return img