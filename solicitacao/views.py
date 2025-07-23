from django.shortcuts import render
from django.db import transaction
from django.db.utils import IntegrityError
from django.db import connection
from .models import Solicitacao
from padrao.models import Padrao
from equipamento.models import Equipamento
from solicitacao.models import DadosSolicitacao
from usuario.models import Funcionario
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from usuario.decorators import somente_master, master_solicit
from django.db.models import Q
import json

@login_required
@master_solicit
def solicitacao_template(request):
    if request.method == 'GET':
        query_value = request.GET.get('query', '')
        
        if request.user.is_superuser == True:
            padroes = Padrao.objects.filter(ativo=True).values('id', 'nome')
        else:
            padroes = Padrao.objects.filter(setor=request.user.funcionario.setor, 
                                            ativo=True).values('id', 'nome')
            
        motivos = [{'id': reason[0], 'nome': reason[1]} for reason in DadosSolicitacao.REASON_CHOICES]
        
        return render(request, 'solicitacao.html', {
            'padroes': padroes,
            'query_value': query_value,  # Passamos o valor da query para o template
            'motivos': motivos
        })
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)

            with transaction.atomic():
                usuario = request.user 
                padrao = data.get('padrao', None)
                
                # Agrupando itens por funcionário
                itens_por_funcionario = {}
                for item in data.get('itens', []):
                    funcionario_id = item['funcionario_id']
                    if funcionario_id not in itens_por_funcionario:
                        itens_por_funcionario[funcionario_id] = []
                    itens_por_funcionario[funcionario_id].append(item)

                # Verificações antes de criar as solicitações
                for funcionario_id, itens in itens_por_funcionario.items():
                    funcionario = Funcionario.objects.get(id=funcionario_id)
                    
                    for item in itens:
                        equipamento = Equipamento.objects.get(id=item['equipamento_id'])
                        motivo = item['motivos']
                        
                        # Verifica se o funcionário já solicitou este equipamento antes
                        ja_solicitou = DadosSolicitacao.objects.filter(
                            solicitacao__funcionario=funcionario,
                            equipamento=equipamento
                        ).exists()
                        
                        # Primeira condição de erro
                        if ja_solicitou and motivo.lower() == 'primeira entrega':
                            return JsonResponse({
                                'success': False,
                                'message': f'Erro: O funcionário {funcionario.nome} já solicitou o equipamento {equipamento.nome} anteriormente e o motivo não pode ser "primeira entrega".'
                            }, status=400)
                        
                        # Segunda condição de erro
                        if not ja_solicitou and motivo.lower() != 'primeira entrega':
                            return JsonResponse({
                                'success': False,
                                'message': f'Erro: O funcionário {funcionario.nome} nunca solicitou o equipamento {equipamento.nome} antes e o motivo deve ser "primeira entrega".'
                            }, status=400)

                # Se passou pelas verificações, cria as solicitações
                for funcionario_id, itens in itens_por_funcionario.items():
                    funcionario = Funcionario.objects.get(id=funcionario_id)
                    
                    if padrao:
                        desc = f"Solicitação com {len(itens)} itens para {funcionario.nome}. Padrão: {padrao}"
                    else:
                        desc = f"Solicitação com {len(itens)} itens para {funcionario.nome}"

                    # Cria a solicitação vinculada ao funcionário
                    solicitacao = Solicitacao.objects.create(
                        solicitante=usuario,
                        funcionario=funcionario,
                        status='Pendente',
                        observacoes=desc,
                    )

                    # Processa cada item para este funcionário
                    for item in itens:
                        equipamento = Equipamento.objects.get(id=item['equipamento_id'])
                        
                        DadosSolicitacao.objects.create(
                            solicitacao=solicitacao,
                            equipamento=equipamento,
                            quantidade=item['quantidades'],
                            observacoes=item['observacoes'],
                            motivo=item['motivos']
                        )

                return JsonResponse({
                    'success': True,
                    'message': f'Solicitações criadas com sucesso para {len(itens_por_funcionario)} funcionários!'
                }, status=201)
            
        except IntegrityError:
            return JsonResponse({
                'success': False,
                'error': "Não é permitido repetir o mesmo equipamento para um funcionário em uma mesma solicitação"
            }, status=400)

        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e),
            }, status=400)

@login_required
@master_solicit
def solicitacao(request):
    
    if request.user.is_superuser == True:
        funcionarios = list(Funcionario.objects.values('id', 'nome', 'matricula'))
    else:
        funcionarios = list(Funcionario.objects.filter(setor=request.user.funcionario.setor).values('id', 'nome', 'matricula'))

    equipamentos = list(Equipamento.objects.values('id', 'nome', 'codigo'))
    
    return JsonResponse({
        'funcionarios': funcionarios,
        'equipamentos': equipamentos,
    }, status=200)

@login_required
@master_solicit
def verificar_equipamentos(request):
    try:
        pares = json.loads(request.GET.get('pares', '[]'))
        if not isinstance(pares, list):
            return JsonResponse({'error': 'Formato inválido: esperado uma lista de pares'}, status=400)
        
        if not pares:
            return JsonResponse({'error': 'Nenhum par funcionário/equipamento fornecido'}, status=400)

        # Extrai e valida os IDs
        pares_validos = []
        for par in pares:
            try:
                func_id = int(par['funcionario_id'])
                equip_id = int(par['equipamento_id'])
                pares_validos.append((func_id, equip_id))
            except (KeyError, ValueError):
                continue

        if not pares_validos:
            return JsonResponse({'error': 'IDs inválidos ou faltando'}, status=400)

        # Cria uma lista de tuplas para a consulta SQL
        pares_tuple = tuple(pares_validos)

        # Query SQL otimizada
        query = """
        SELECT ds.equipamento_id, s.funcionario_id
        FROM solicitacao_dadossolicitacao ds
        JOIN solicitacao_solicitacao s ON ds.solicitacao_id = s.id
        WHERE (s.funcionario_id, ds.equipamento_id) IN %s
        AND s.status != 'Cancelado'
        """

        with connection.cursor() as cursor:
            cursor.execute(query, [pares_tuple])
            existentes = cursor.fetchall()

        # Converte para um conjunto de tuplas (func_id, equip_id)
        existentes_set = {(func_id, equip_id) for equip_id, func_id in existentes}

        # Prepara o resultado
        resultado = {
            f"{func_id}_{equip_id}": (func_id, equip_id) in existentes_set
            for func_id, equip_id in pares_validos
        }

        return JsonResponse(resultado)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)