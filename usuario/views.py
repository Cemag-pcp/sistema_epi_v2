from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponse
from django.contrib.auth.decorators import login_required
from django.contrib.auth.password_validation import validate_password
from django.views.decorators.http import require_http_methods
from django.utils import timezone

from django.core.exceptions import ValidationError
from django.db.models import Sum, F, Q
from django.db import transaction, DatabaseError
from django.core.exceptions import ObjectDoesNotExist
from django.core.files.base import ContentFile

from usuario.models import Funcionario,Setor,Usuario,Cargo,DDS,DDSAssinatura
from solicitacao.models import DadosSolicitacao
from usuario.decorators import somente_master, master_solicit

import traceback
import json
import base64
import uuid
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont


def serializar_dds(dds):
    participantes = list(dds.participantes.order_by('nome').values('id', 'nome', 'matricula'))
    assinaturas = list(
        dds.assinaturas.select_related('funcionario')
        .order_by('funcionario__nome')
        .values('funcionario_id', 'funcionario__nome', 'funcionario__matricula', 'imagem_assinatura')
    )
    return {
        'id': dds.id,
        'titulo': dds.titulo,
        'data': dds.data.isoformat(),
        'horario': dds.horario.strftime('%H:%M'),
        'responsavel': (
            {
                'id': dds.responsavel.id,
                'nome': dds.responsavel.nome,
                'matricula': dds.responsavel.matricula,
            }
            if dds.responsavel else None
        ),
        'responsavel_label': str(dds.responsavel) if dds.responsavel else '--',
        'participantes': participantes,
        'assinaturas': [
            {
                'funcionario_id': assinatura['funcionario_id'],
                'nome': assinatura['funcionario__nome'],
                'matricula': assinatura['funcionario__matricula'],
                'imagem_assinatura': assinatura['imagem_assinatura'],
            }
            for assinatura in assinaturas
        ],
        'assinaturas_ids': [assinatura['funcionario_id'] for assinatura in assinaturas],
        'participantes_label': ', '.join(
            f"{participante['matricula']} - {participante['nome']}" for participante in participantes
        ),
        'created_at': dds.created_at.strftime('%d/%m/%Y %H:%M'),
        'updated_at': dds.updated_at.strftime('%d/%m/%Y %H:%M'),
        'criado_por': str(dds.criado_por) if dds.criado_por else '--',
    }


def normalizar_assinaturas_dds(assinaturas_payload):
    if not isinstance(assinaturas_payload, list):
        raise ValidationError({'assinaturas': 'Formato de assinaturas invalido'})

    assinaturas_normalizadas = {}
    for assinatura in assinaturas_payload:
        if not isinstance(assinatura, dict):
            raise ValidationError({'assinaturas': 'Formato de assinaturas invalido'})

        funcionario_id = assinatura.get('funcionario_id')
        signature = assinatura.get('signature')
        if not funcionario_id or not signature:
            raise ValidationError({'assinaturas': 'Assinatura incompleta para participante'})

        assinaturas_normalizadas[int(funcionario_id)] = signature

    return assinaturas_normalizadas


def salvar_assinaturas_dds(dds, assinaturas_por_funcionario):
    for funcionario_id, signature in assinaturas_por_funcionario.items():
        image_format, imgstr = signature.split(';base64,')
        ext = image_format.split('/')[-1]
        file_name = f"dds-{dds.id}-{funcionario_id}-{uuid.uuid4()}.{ext}"
        assinatura_path = ContentFile(base64.b64decode(imgstr), name=file_name)

        DDSAssinatura.objects.update_or_create(
            dds=dds,
            funcionario_id=funcionario_id,
            defaults={'imagem_assinatura': assinatura_path}
        )


def get_pdf_font(size, bold=False):
    font_candidates = [
        "arialbd.ttf" if bold else "arial.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    ]
    for font_name in font_candidates:
        try:
            return ImageFont.truetype(font_name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_text(draw, text, position, font, fill, max_width, line_spacing=8):
    words = str(text).split()
    lines = []
    current_line = ""

    for word in words:
        test_line = f"{current_line} {word}".strip()
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] <= max_width or not current_line:
            current_line = test_line
        else:
            lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    x, y = position
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        bbox = draw.textbbox((x, y), line, font=font)
        y += (bbox[3] - bbox[1]) + line_spacing

    return y


def build_dds_pdf(dds):
    page_width, page_height = 1240, 1754
    margin = 80
    content_width = page_width - (margin * 2)
    text_color = "black"
    muted_color = "black"
    line_color = "black"

    title_font = get_pdf_font(30, bold=True)
    section_font = get_pdf_font(20, bold=True)
    label_font = get_pdf_font(15, bold=True)
    body_font = get_pdf_font(15)
    small_font = get_pdf_font(12)

    pages = []
    page = Image.new("RGB", (page_width, page_height), "white")
    draw = ImageDraw.Draw(page)
    y = margin

    def new_page():
        nonlocal page, draw, y
        pages.append(page)
        page = Image.new("RGB", (page_width, page_height), "white")
        draw = ImageDraw.Draw(page)
        y = margin

    def ensure_space(required_height):
        nonlocal y
        if y + required_height > page_height - margin:
            new_page()

    draw.rectangle((margin, y, page_width - margin, y + 120), outline=line_color, width=2)
    draw.text((margin + 30, y + 18), "REGISTRO DE DDS", font=title_font, fill=text_color)
    draw.text((margin + 30, y + 62), "Documento de controle interno para auditoria", font=body_font, fill=text_color)
    draw.text((page_width - margin - 250, y + 24), f"Documento: DDS-{dds.id:05d}", font=label_font, fill=text_color)
    draw.text((page_width - margin - 250, y + 56), f"Emissão: {timezone.localtime().strftime('%d/%m/%Y %H:%M')}", font=body_font, fill=text_color)
    y += 155

    draw.text((margin, y), "1. Identificação da DDS", font=section_font, fill=text_color)
    y += 30
    draw.line((margin, y, page_width - margin, y), fill=line_color, width=2)
    y += 24

    info_rows = [
        ("Tema", dds.titulo),
        ("Data", dds.data.strftime('%d/%m/%Y')),
        ("Horário", dds.horario.strftime('%H:%M')),
        ("Responsável", str(dds.responsavel) if dds.responsavel else "--"),
        ("Registrado por", str(dds.criado_por) if dds.criado_por else "--"),
        ("Última atualização", dds.updated_at.strftime('%d/%m/%Y %H:%M')),
    ]

    label_width = 220
    row_height = 42
    for label, value in info_rows:
        ensure_space(row_height + 8)
        draw.rectangle((margin, y, margin + label_width, y + row_height), outline=line_color, width=1)
        draw.rectangle((margin + label_width, y, page_width - margin, y + row_height), outline=line_color, width=1)
        draw.text((margin + 12, y + 11), label, font=label_font, fill=text_color)
        draw.text((margin + label_width + 12, y + 11), str(value), font=body_font, fill=text_color)
        y += row_height

    y += 28

    participantes = list(dds.participantes.order_by('nome'))
    assinaturas = {
        assinatura.funcionario_id: assinatura
        for assinatura in dds.assinaturas.select_related('funcionario').all()
    }

    draw.text((margin, y), "2. Participantes", font=section_font, fill=text_color)
    y += 30
    draw.line((margin, y, page_width - margin, y), fill=line_color, width=2)
    y += 22

    matricula_width = 180
    nome_width = 420
    assinatura_width = content_width - matricula_width - nome_width
    table_header_height = 40
    row_height = 150

    def draw_table_header(top_y):
        draw.rectangle((margin, top_y, page_width - margin, top_y + table_header_height), outline=line_color, width=2)
        draw.line((margin + matricula_width, top_y, margin + matricula_width, top_y + table_header_height), fill=line_color, width=2)
        draw.line((margin + matricula_width + nome_width, top_y, margin + matricula_width + nome_width, top_y + table_header_height), fill=line_color, width=2)
        draw.text((margin + 12, top_y + 10), "Matricula", font=label_font, fill=text_color)
        draw.text((margin + matricula_width + 12, top_y + 10), "Nome", font=label_font, fill=text_color)
        draw.text((margin + matricula_width + nome_width + 12, top_y + 10), "Assinatura", font=label_font, fill=text_color)

    draw_table_header(y)
    y += table_header_height

    for participante in participantes:
        ensure_space(row_height + 20)
        if y == margin:
            draw.text((margin, y), "2. Participantes", font=section_font, fill=text_color)
            y += 30
            draw.line((margin, y, page_width - margin, y), fill=line_color, width=2)
            y += 22
            draw_table_header(y)
            y += table_header_height

        draw.rectangle((margin, y, page_width - margin, y + row_height), outline=line_color, width=1)
        draw.line((margin + matricula_width, y, margin + matricula_width, y + row_height), fill=line_color, width=1)
        draw.line((margin + matricula_width + nome_width, y, margin + matricula_width + nome_width, y + row_height), fill=line_color, width=1)

        draw.text((margin + 12, y + 16), str(participante.matricula), font=body_font, fill=text_color)
        draw_text(
            draw,
            participante.nome,
            (margin + matricula_width + 12, y + 16),
            body_font,
            text_color,
            nome_width - 24,
            4
        )

        assinatura = assinaturas.get(participante.id)
        assinatura_area = (
            margin + matricula_width + nome_width + 12,
            y + 12,
            page_width - margin - 12,
            y + row_height - 28
        )
        draw.rectangle(assinatura_area, outline=line_color, width=1)

        if assinatura and assinatura.imagem_assinatura:
            try:
                assinatura.imagem_assinatura.open("rb")
                signature_image = Image.open(assinatura.imagem_assinatura).convert("RGBA")
                signature_image.thumbnail(
                    (assinatura_area[2] - assinatura_area[0] - 12, assinatura_area[3] - assinatura_area[1] - 12)
                )
                sig_x = assinatura_area[0] + ((assinatura_area[2] - assinatura_area[0]) - signature_image.width) // 2
                sig_y = assinatura_area[1] + ((assinatura_area[3] - assinatura_area[1]) - signature_image.height) // 2
                page.paste(signature_image, (sig_x, sig_y), signature_image)
            except Exception:
                draw.text((assinatura_area[0] + 12, assinatura_area[1] + 20), "Assinatura indisponível", font=body_font, fill=text_color)
        else:
            draw.text((assinatura_area[0] + 12, assinatura_area[1] + 20), "Assinatura não encontrada", font=body_font, fill=text_color)

        draw.text((assinatura_area[0], y + row_height - 22), "Assinatura do participante", font=small_font, fill=text_color)
        y += row_height

    y += 24
    ensure_space(140)
    draw.text((margin, y), "3. Observações de controle", font=section_font, fill=text_color)
    y += 30
    draw.line((margin, y, page_width - margin, y), fill=line_color, width=2)
    y += 20
    observacoes = [
        "Este documento registra os participantes presentes na DDS e suas respectivas assinaturas.",
        "As assinaturas foram coletadas eletronicamente no sistema e vinculadas ao registro da DDS.",
        f"Quantidade total de participantes assinantes: {len(participantes)}.",
    ]
    for observacao in observacoes:
        y = draw_text(draw, f"- {observacao}", (margin, y), body_font, text_color, content_width, 6)
        y += 6

    draw.line((margin, page_height - margin - 28, page_width - margin, page_height - margin - 28), fill=line_color, width=1)
    draw.text((margin, page_height - margin), "Sistema EPI - Documento gerado eletronicamente para fins de auditoria", font=small_font, fill=text_color)
    pages.append(page)

    buffer = BytesIO()
    pages[0].save(buffer, format="PDF", resolution=150.0, save_all=True, append_images=pages[1:])
    buffer.seek(0)
    return buffer

def login_view(request):
    if request.method == 'POST':
        # matricula
        matricula = request.POST.get('matricula')
        password = request.POST.get('password')

        user = authenticate(request, username=matricula, password=password)
        funcionario = getattr(user, 'funcionario', None) if user else None
        if user and (user.is_superuser or (funcionario and funcionario.ativo)):
            login(request, user)
            if user.is_superuser or (funcionario and funcionario.tipo_acesso == 'master'):
                print('Redirecionando para a página de administração')
                next_url = request.POST.get('next') or 'core:home'
                # Redirecionar para a página inicial de solicitações
            elif funcionario and funcionario.tipo_acesso == 'solicitante':
                print('Redirecionando para a página de funcionário')
                next_url = request.POST.get('next') or 'solicitacao:solicitacao'
                # Enquanto ainda não existe uma página de solicitação EPI, vamos redirecionar para a home
            else:
                print('Redirecionando para a página padrão')
                next_url = request.POST.get('next') or 'usuario:inventario'
                #Enquanto ainda não existe uma página de (inventário??) vamos redirecionar para a home
            print(request.POST.get('next'))
            return redirect(next_url)
            
        else:
            # Aqui você pode adicionar uma mensagem de erro se o login falhar
            messages.error(request, "Usuário ou senha inválidos.", extra_tags='danger')
    if request.user.is_authenticated:
        return redirect('core:home')
    return render(request, 'usuario/login.html')

def logout_view(request):
    logout(request)
    return redirect('usuario:login_view')

def redirecionar(request):
    return redirect('usuario:login_view')

@login_required
def api_funcionarios(request):
    if request.method == 'GET':
        funcionario_id = request.GET.get('func_id',None)
        
        # Converter para float de forma segura
        try:
            func_id = int(funcionario_id)
        except (TypeError, ValueError):
            func_id = None  # Se não for um número válido
        
        # Aqui você pode adicionar a lógica para listar os funcionários
        if func_id is None and not request.user.is_superuser and not request.user.funcionario.tipo_acesso == 'master':
                return JsonResponse({'error': 'Acesso negado'}, status=403)
        if func_id:
            try:
                funcionario = Funcionario.objects.get(id=func_id)
                return JsonResponse([{
                    'id': funcionario.id,
                    'nome': funcionario.nome,
                    'matricula': funcionario.matricula,
                    'setor': funcionario.setor.nome if funcionario.setor else '',
                    'cargo': funcionario.cargo.nome if funcionario.cargo else '',
                    'data_admissao': funcionario.data_admissao,
                    'ativo': funcionario.ativo,
                    'usuario': funcionario.usuario.id if funcionario.usuario else '',
                    'tipo_acesso': funcionario.tipo_acesso,
                }], safe=False,status=200)
            except Funcionario.DoesNotExist:
                return JsonResponse({'error': 'Funcionário não encontrado'}, status=404)
        # Se não houver id, retorna todos os funcionários
        funcionarios = Funcionario.objects.select_related('setor','setor__responsavel','cargo').values(
            'id', 'nome', 'matricula', 'setor__nome', 'setor__id',
                'setor__responsavel__nome', 'setor__responsavel__matricula','cargo_id',
                'cargo__nome', 'data_admissao', 'ativo','usuario','tipo_acesso',
        ).order_by('id')
        


        list_funcionarios = [
           {
                'id': f['id'],
                'nome': f['nome'],
                'matricula': f['matricula'],
                'setor': f['setor__nome'] if f['setor__nome'] else '',
                'cargo': f['cargo__nome'] if f['cargo__nome'] else '',
                'responsavel': f"{f['setor__responsavel__matricula']} - {f['setor__responsavel__nome']}" if f['setor__responsavel__matricula'] else '--',
                'dataAdmissao': f['data_admissao'],
                'status': 'Ativo' if f['ativo'] else 'Desativado',
                'setorId': f['setor__id'] if f['setor__id'] else '',
                'usuario': f['usuario'] if f['usuario'] else '', 
                'hasUsuario': bool(f['usuario']),
                'tipoAcesso': f['tipo_acesso'],
                'cargoId': f['cargo_id'] if f['cargo_id'] else '',
            }
            for f in funcionarios
        ]

        return JsonResponse(list_funcionarios, safe=False)
    return JsonResponse({'status': 'error', 'message': 'Método não permitido!'}, status=405)

@login_required
@somente_master
@require_http_methods(["GET", "POST"])
def funcionario(request):
    if request.method == 'GET':
        return render(request, 'usuario/funcionario.html')
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            print(data)

            # Validação do json
            required_fields = ['nome', 'matricula', 'setor', 'cargo','tipoAcesso']
            if not all(field in data for field in required_fields):
                return JsonResponse({
                    'success': False,
                    'message': 'Campos obrigatórios faltando',
                    'errors': {field: 'Este campo é obrigatório' for field in required_fields if field not in data}
                }, status=400)
            
            novo_cargo = Cargo.objects.filter(id=int(data['cargoId'])).first()
            #Criar o funcionário
            funcionario = Funcionario(
                nome=data['nome'],
                matricula=data['matricula'],
                setor_id=int(data['setorId']),
                cargo=novo_cargo,
                data_admissao=data['dataAdmissao'],
                tipo_acesso=data['tipoAcesso'],
                ativo=True,
            )
            funcionario.full_clean()  # Valida os dados do funcionário
            funcionario.save()

            return JsonResponse({
                'success': True,
                'message': 'Funcionário cadastrado com sucesso!',
                'funcionario': {
                    'id': funcionario.id,
                    'nome': funcionario.nome,
                    'matricula': int(funcionario.matricula),
                    'setor': funcionario.setor.nome,
                    'cargo': funcionario.cargo.nome,
                    'usuario': False, 
                    'hasUsuario': False,
                    'data_admissao': funcionario.data_admissao,
                    'tipo_acesso': funcionario.tipo_acesso,
                    'status': 'Ativo' if funcionario.ativo else 'Desativado',
                }
            }, status=201)
        
        except ValidationError as e:
            return JsonResponse({
                'success': False,
                'message': 'Erro de validação',
                'errors': e.message_dict
            }, status=400)
        
        except Exception as e:
            print('Stack trace:',traceback.format_exc())  # Captura a stack trace completa como string
            return JsonResponse({
                'success': False,
                'message': 'Erro ao cadastrar funcionário',
                'errors': str(e)
            }, status=500)

    return JsonResponse({'status': 'success', 'message': 'Funcionário cadastrado com sucesso!'})

@login_required
@master_solicit
@require_http_methods(["GET"])
def get_funcionarios_pelo_setor(request, id):

    if request.method == 'GET':

        funcionarios = list(Funcionario.objects.filter(setor__id=id).values('id','nome','matricula'))

        return JsonResponse({'funcionarios':funcionarios}, status=200)

@login_required
@somente_master
def editar_funcionario(request, id):
    try:
        funcionario = Funcionario.objects.filter(id=id).first()
        
        if not funcionario:
            return JsonResponse(
                {'success': False, 'message': 'Funcionário não encontrado'}, 
                status=404
            )

        if request.method == 'PUT':
            try:
                data = json.loads(request.body) if request.body else {}
                print(data)
                # Validação do json
                required_fields = ['setor', 'cargo','tipoAcesso']
                if not all(field in data for field in required_fields):
                    return JsonResponse({
                        'success': False,
                        'message': 'Campos obrigatórios faltando',
                        'errors': {field: 'Este campo é obrigatório' for field in required_fields if field not in data}
                    }, status=400)
                
                
                # Atualização dos campos
                # Fazer algo depois para retornar não-modificado caso não mude nada nos atributos
                
                # funcionario.nome = data.get('nome', funcionario.nome)
                # funcionario.matricula = data.get('matricula', funcionario.matricula)

                # verifica o setor antigo para verificar se o responsável do setor antigo é o funcionário
                with transaction.atomic():
                    setor_antigo = funcionario.setor  

                    # Se o funcionario for responsável de um setor, trocará o responsável do setor antigo para None
                    if funcionario.setor.responsavel and funcionario.setor.responsavel.id == funcionario.id:
                        setor_antigo.responsavel = None
                        setor_antigo.save()
                    
                    funcionario.setor_id = int(data.get('setorId', funcionario.setor_id))
                    novo_cargo = Cargo.objects.filter(id=int(data.get('cargoId', funcionario.cargo))).first()
                    funcionario.cargo = novo_cargo
                    # funcionario.data_admissao = data.get('dataAdmissao', funcionario.data_admissao)
                    funcionario.tipo_acesso = data.get('tipoAcesso', funcionario.tipo_acesso)
                    
                    
                    funcionario.full_clean()  # Valida o modelo antes de salvar
                    funcionario.save()
                
                return JsonResponse({
                    'success': True,
                    'message': 'Funcionário atualizado com sucesso!',
                    'funcionario': {
                        'id': funcionario.id,
                        'nome': funcionario.nome,
                        'matricula': funcionario.matricula,
                        'setor': funcionario.setor.nome,
                        'cargo': funcionario.cargo.nome,
                        'data_admissao': funcionario.data_admissao,
                        'tipo_acesso': funcionario.tipo_acesso,
                        'status': 'Ativo' if funcionario.ativo else 'Desativado',
                        }
                    }, status=201)

            except json.JSONDecodeError as e:
                print(e)
                return JsonResponse(
                    {'success': False, 'message': 'Formato JSON inválido'},
                    status=400
                )
            except ValidationError as e:
                print(e)
                return JsonResponse({
                    'success': False,
                    'message': 'Erro de validação',
                    'errors': e.message_dict
                }, status=400)

            except ValueError as e:
                print(e)
                return JsonResponse(
                    {'success': False, 'message': str(e)},
                    status=400
                )

            except Exception as e:  
                print('Stack trace:', traceback.format_exc()) # Captura a stack trace completa como string
                return JsonResponse({
                    'success': False,
                    'message': 'Erro ao atualizar funcionário',
                    'errors': str(e)
                }, status=500)

        elif request.method == 'PATCH':
            try:
                funcionario.ativo = not funcionario.ativo
                funcionario.save()
                
                return JsonResponse({
                    'success': True, 
                    'message': f'Funcionário {"ativado" if funcionario.ativo else "desativado"} com sucesso',
                    'novo_status': funcionario.ativo
                }, status=201)
                
            except Exception as e:
                return JsonResponse(
                    {'success': False, 'message': f'Erro ao alterar status: {str(e)}'},
                    status=500
                )

    except Exception as e:
        return JsonResponse(
            {'success': False, 'message': f'Erro interno no servidor: {str(e)}'},
            status=500
        )

@login_required
@master_solicit
def api_setores(request):
    if request.method == 'GET':
        setor_id = request.GET.get('setor_id')
        
        query = Setor.objects.select_related('responsavel')
        
        if setor_id:
            query = query.filter(id=setor_id)
        
        setores = query.values(
            'id',
            'nome',
            'responsavel_id',
            'responsavel__nome',
            'responsavel__matricula'
        )

        setores_list = [
            {
                **s,
                'responsavel_id': s['responsavel_id'] if s['responsavel_id'] else '',
                'responsavel__nome': s['responsavel__nome'] if s['responsavel_id'] else '--',
                'responsavel__matricula': s['responsavel__matricula'] if s['responsavel_id'] else '',
            }
            for s in setores
        ]
        
        return JsonResponse(setores_list, safe=False)
    return JsonResponse({'status': 'success', 'message': 'Setores listados com sucesso!'})

@login_required
@somente_master
@require_http_methods(["GET","POST"])
def usuario(request):
    if request.method == 'GET':
        tipo_acesso = request.GET.get('tipoAcesso')

        # Filtra diretamente os funcionários
        funcionarios = Funcionario.objects.filter(ativo=True)
        
        if tipo_acesso in ["solicitante", "operador"]:
            funcionarios = funcionarios.filter(tipo_acesso=tipo_acesso)

        # Converte para o formato desejado (similar ao anterior)
        dados = list(funcionarios.values(
            'id',
            'nome',
            'matricula',
            'tipo_acesso'
        ))

        # Adiciona campos vazios para manter compatibilidade com o formato anterior
        for item in dados:
            item['funcionario__id'] = item['id']
            item['funcionario__nome'] = item['nome']
            item['funcionario__matricula'] = item['matricula']
            item['funcionario__tipo_acesso'] = item['tipo_acesso']
            item['id'] = None  # ID do usuário (não existe mais)
            item['nome'] = None  # Nome do usuário (não existe mais)

        return JsonResponse(dados, safe=False)
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            # print(data)


            # Validação do json
            required_fields = ['nome', 'matricula', 'funcionarioId']
            if not all(field in data for field in required_fields):
                return JsonResponse({
                    'success': False,
                    'message': 'Campos obrigatórios faltando',
                    'errors': {field: 'Este campo é obrigatório' for field in required_fields if field not in data}
                }, status=400)

            # Criar o usuário
            with transaction.atomic():
                usuario = Usuario(
                    nome=data['nome'],
                    matricula=data['matricula'],
                    funcionario_id=int(data['funcionarioId']),
                    is_staff=True,  # Definindo como True para permitir acesso ao admin
                    is_superuser=False  # Definindo como False por padrão
                )
                validate_password(data['senha'], user=usuario)
                usuario.set_password(data['senha'])
                usuario.full_clean()  # Valida os dados do usuário
                usuario.save()

                funcionario = get_object_or_404(Funcionario,pk=data['funcionarioId'])
                funcionario.tipo_acesso = data['tipoAcesso']
                funcionario.save()

            return JsonResponse({
                'success': True,
                'message': 'Usuário cadastrado com sucesso!',
                'usuario': {
                    'id': usuario.id,
                    'nome': usuario.nome,
                    'matricula': usuario.matricula,
                    'tipo_acesso': funcionario.tipo_acesso,
                    'funcionario_id': usuario.funcionario_id,
                }
            }, status=201)

        except ValidationError as e:
            print('Stack trace:', traceback.format_exc())
            return JsonResponse({
                'success': False,
                'message': 'Erro de validação',
                'errors': {'validação': e.messages}
            }, status=400)

        except Exception as e:
            print('Stack trace:', traceback.format_exc())
            return JsonResponse({
                'success': False,
                'message': 'Erro ao cadastrar usuário',
                'errors': str(e)
            }, status=500)
        

@login_required
@somente_master
def busca_setor(request,id):
    if request.method == 'GET':
        try:
            setor = get_object_or_404(Setor,pk=id)

            responsavel_setor = {
                'matricula': setor.responsavel.matricula if setor.responsavel else None,
                'nome': setor.responsavel.nome if setor.responsavel else None,
            }

            return JsonResponse(responsavel_setor)
        
        except Exception as e:
            print('Stack trace:', traceback.format_exc())
            return JsonResponse({
                'success': False,
                'message': 'Erro ao buscar Setores',
                'errors': str(e)
            }, status=500)
        
@login_required
@somente_master
def setores(request):
    if request.method == 'GET':
        return render(request,'usuario/setores.html')

@login_required
@somente_master
@require_http_methods(["GET", "POST"])
def cargos(request):
    if request.method == 'GET':
        return render(request, 'usuario/cargos.html')

    if request.method == 'POST':
        try:
            data = json.loads(request.body) if request.body else {}
            nome = data.get('nome', '').strip()

            if not nome:
                return JsonResponse({
                    'success': False,
                    'message': 'Campo obrigatorio faltando',
                    'errors': {'nome': 'Este campo e obrigatorio'}
                }, status=400)

            if Cargo.objects.filter(nome__iexact=nome).exists():
                return JsonResponse({
                    'success': False,
                    'message': 'Ja existe um cargo com este nome',
                    'errors': {'nome': 'Cargo duplicado'}
                }, status=400)

            cargo = Cargo(nome=nome)
            cargo.full_clean()
            cargo.save()

            return JsonResponse({
                'success': True,
                'message': 'Cargo cadastrado com sucesso!',
                'cargo': {'id': cargo.id, 'nome': cargo.nome}
            }, status=201)

        except ValidationError as e:
            return JsonResponse({
                'success': False,
                'message': 'Erro de validacao',
                'errors': e.message_dict
            }, status=400)
        except Exception as e:
            print('Stack trace:', traceback.format_exc())
            return JsonResponse({
                'success': False,
                'message': 'Erro ao cadastrar cargo',
                'errors': str(e)
            }, status=500)
    
@login_required
@somente_master
def editar_setor(request,id):
    #Editar o responsável do setor
    try:
        setor = Setor.objects.filter(id=id).first()
        
        if not setor:
            return JsonResponse(
                {'success': False, 'message': 'Setor não encontrado'}, 
                status=404
            )

        if request.method == 'PATCH':
            try:

                data = json.loads(request.body) if request.body else {}
                print(data)
                forcar = data['forcar'] == True
                # print(forcar)
                setor_antigo = None
                if forcar:
                    print('entrou no forcar')
                    with transaction.atomic():
                        novo_responsavel = Funcionario.objects.filter(id=data['responsavel']).first()
                        setor_antigo = Setor.objects.filter(id=novo_responsavel.setor.id).first()
                        setor_antigo.responsavel=None
                        setor_antigo.save()

                        novo_responsavel.setor = setor
                        novo_responsavel.save()

                        setor.responsavel = novo_responsavel
                        setor.save()
                else:
                    for s in data.get('setores',[]):
                        print(data['responsavel'] == s['responsavel_id'])
                        if data['responsavel'] == s['responsavel_id'] and setor.id != s['id']:
                            return JsonResponse(
                            {'success': False, 'message': f'Solicitante escolhido já é responsável de outro setor!'},
                            status=500
                        )

                    with transaction.atomic():
                        novo_responsavel = Funcionario.objects.filter(id=data['responsavel']).first()
                        setor.responsavel = novo_responsavel

                        novo_responsavel.setor = setor
                        novo_responsavel.save()

                        setor.save()
                
                return JsonResponse({
                    'success': True, 
                    'message': f'Responsavel alterado com sucesso!',
                    'responsavel': {'id':setor.responsavel.id, 
                                    'nome': setor.responsavel.nome, 
                                    'matricula': setor.responsavel.matricula, 
                                    'setorVazio': setor_antigo.id if setor_antigo else ''
                                    }
                }, status=201)
                
            except Exception as e:
                print('Stack trace:', traceback.format_exc())
                print(e)
                return JsonResponse(
                    {'success': False, 'message': f'Erro ao alterar responsável: {str(e)}'},
                    status=500
                )

    except Exception as e:
        print(e)
        return JsonResponse(
            {'success': False, 'message': f'Erro interno no servidor: {str(e)}'},
            status=500
        )

@login_required
@somente_master
@require_http_methods(["PUT", "DELETE"])
def editar_cargo(request, id):
    try:
        cargo = Cargo.objects.filter(id=id).first()

        if not cargo:
            return JsonResponse(
                {'success': False, 'message': 'Cargo nao encontrado'},
                status=404
            )

        if request.method == 'PUT':
            try:
                data = json.loads(request.body) if request.body else {}
                nome = data.get('nome', '').strip()

                if not nome:
                    return JsonResponse({
                        'success': False,
                        'message': 'Campo obrigatorio faltando',
                        'errors': {'nome': 'Este campo e obrigatorio'}
                    }, status=400)

                if Cargo.objects.filter(nome__iexact=nome).exclude(id=cargo.id).exists():
                    return JsonResponse({
                        'success': False,
                        'message': 'Ja existe um cargo com este nome',
                        'errors': {'nome': 'Cargo duplicado'}
                    }, status=400)

                cargo.nome = nome
                cargo.full_clean()
                cargo.save()

                return JsonResponse({
                    'success': True,
                    'message': 'Cargo atualizado com sucesso!',
                    'cargo': {'id': cargo.id, 'nome': cargo.nome}
                }, status=200)

            except json.JSONDecodeError:
                return JsonResponse(
                    {'success': False, 'message': 'Formato JSON invalido'},
                    status=400
                )
            except ValidationError as e:
                return JsonResponse({
                    'success': False,
                    'message': 'Erro de validacao',
                    'errors': e.message_dict
                }, status=400)
            except Exception as e:
                print('Stack trace:', traceback.format_exc())
                return JsonResponse({
                    'success': False,
                    'message': 'Erro ao atualizar cargo',
                    'errors': str(e)
                }, status=500)

        if request.method == 'DELETE':
            cargo.delete()
            return JsonResponse({
                'success': True,
                'message': 'Cargo removido com sucesso!'
            }, status=200)

    except Exception as e:
        print('Stack trace:', traceback.format_exc())
        return JsonResponse(
            {'success': False, 'message': f'Erro interno no servidor: {str(e)}'},
            status=500
        )
    
@login_required
@somente_master
def api_cargos(request):
    if request.method == 'GET':
        cargos = list(Cargo.objects.values('id', 'nome').order_by('nome'))

        return JsonResponse(cargos, safe=False)


@login_required
def dds(request):
    if request.method == 'GET':
        return render(request, 'usuario/dds.html')


@login_required
@require_http_methods(["GET"])
def api_dds_participantes(request):
    participantes = list(
        Funcionario.objects.filter(ativo=True)
        .values('id', 'nome', 'matricula')
        .order_by('nome')
    )
    return JsonResponse(participantes, safe=False)


@login_required
@require_http_methods(["GET", "POST"])
def api_dds(request):
    if request.method == 'GET':
        dds_registros = DDS.objects.prefetch_related('participantes', 'assinaturas__funcionario').select_related('criado_por', 'responsavel')
        return JsonResponse([serializar_dds(dds) for dds in dds_registros], safe=False)

    try:
        data = json.loads(request.body) if request.body else {}
        required_fields = ['titulo', 'data', 'horario', 'responsavel', 'participantes', 'assinaturas']
        if not all(field in data for field in required_fields):
            return JsonResponse({
                'success': False,
                'message': 'Campos obrigatorios faltando',
                'errors': {field: 'Este campo e obrigatorio' for field in required_fields if field not in data}
            }, status=400)

        participantes_ids = data.get('participantes', [])
        responsavel_id = data.get('responsavel')
        assinaturas_por_funcionario = normalizar_assinaturas_dds(data.get('assinaturas', []))
        if not isinstance(participantes_ids, list) or not participantes_ids:
            return JsonResponse({
                'success': False,
                'message': 'Selecione pelo menos um participante',
                'errors': {'participantes': 'Selecione pelo menos um participante'}
            }, status=400)
        if not responsavel_id:
            return JsonResponse({
                'success': False,
                'message': 'Selecione um responsavel',
                'errors': {'responsavel': 'Selecione um responsavel'}
            }, status=400)

        participantes = list(Funcionario.objects.filter(id__in=participantes_ids, ativo=True))
        if len(participantes) != len(set(participantes_ids)):
            return JsonResponse({
                'success': False,
                'message': 'Existem participantes invalidos na selecao',
                'errors': {'participantes': 'Existem participantes invalidos na selecao'}
            }, status=400)

        responsavel = Funcionario.objects.filter(id=responsavel_id, ativo=True).first()
        if not responsavel:
            return JsonResponse({
                'success': False,
                'message': 'Responsavel invalido na selecao',
                'errors': {'responsavel': 'Responsavel invalido na selecao'}
            }, status=400)

        if responsavel.id not in {participante.id for participante in participantes}:
            return JsonResponse({
                'success': False,
                'message': 'O responsavel precisa estar entre os participantes',
                'errors': {'responsavel': 'O responsavel precisa estar entre os participantes'}
            }, status=400)

        participantes_ids_set = {participante.id for participante in participantes}
        assinaturas_ids_set = set(assinaturas_por_funcionario.keys())
        if participantes_ids_set != assinaturas_ids_set:
            return JsonResponse({
                'success': False,
                'message': 'Todos os participantes devem assinar a DDS',
                'errors': {'assinaturas': 'Todos os participantes devem assinar a DDS'}
            }, status=400)

        with transaction.atomic():
            dds = DDS(
                titulo=data.get('titulo', '').strip(),
                data=data.get('data'),
                horario=data.get('horario'),
                responsavel=responsavel,
                criado_por=request.user,
            )
            dds.full_clean()
            dds.save()
            dds.participantes.set(participantes)
            salvar_assinaturas_dds(dds, assinaturas_por_funcionario)

        return JsonResponse({
            'success': True,
            'message': 'DDS cadastrada com sucesso!',
            'dds': serializar_dds(dds)
        }, status=201)

    except ValidationError as e:
        return JsonResponse({
            'success': False,
            'message': 'Erro de validacao',
            'errors': e.message_dict
        }, status=400)
    except Exception as e:
        print('Stack trace:', traceback.format_exc())
        return JsonResponse({
            'success': False,
            'message': 'Erro ao cadastrar DDS',
            'errors': str(e)
        }, status=500)


@login_required
@require_http_methods(["PUT", "DELETE"])
def editar_dds(request, id):
    dds = DDS.objects.prefetch_related('assinaturas').filter(id=id).first()
    if not dds:
        return JsonResponse({
            'success': False,
            'message': 'DDS nao encontrada'
        }, status=404)

    if request.method == 'DELETE':
        try:
            dds.delete()
            return JsonResponse({
                'success': True,
                'message': 'DDS removida com sucesso!'
            }, status=200)
        except Exception as e:
            print('Stack trace:', traceback.format_exc())
            return JsonResponse({
                'success': False,
                'message': 'Erro ao remover DDS',
                'errors': str(e)
            }, status=500)

    try:
        data = json.loads(request.body) if request.body else {}
        required_fields = ['titulo', 'data', 'horario', 'responsavel', 'participantes', 'assinaturas']
        if not all(field in data for field in required_fields):
            return JsonResponse({
                'success': False,
                'message': 'Campos obrigatorios faltando',
                'errors': {field: 'Este campo e obrigatorio' for field in required_fields if field not in data}
            }, status=400)

        participantes_ids = data.get('participantes', [])
        responsavel_id = data.get('responsavel')
        assinaturas_por_funcionario = normalizar_assinaturas_dds(data.get('assinaturas', []))
        if not isinstance(participantes_ids, list) or not participantes_ids:
            return JsonResponse({
                'success': False,
                'message': 'Selecione pelo menos um participante',
                'errors': {'participantes': 'Selecione pelo menos um participante'}
            }, status=400)
        if not responsavel_id:
            return JsonResponse({
                'success': False,
                'message': 'Selecione um responsavel',
                'errors': {'responsavel': 'Selecione um responsavel'}
            }, status=400)

        participantes = list(Funcionario.objects.filter(id__in=participantes_ids, ativo=True))
        if len(participantes) != len(set(participantes_ids)):
            return JsonResponse({
                'success': False,
                'message': 'Existem participantes invalidos na selecao',
                'errors': {'participantes': 'Existem participantes invalidos na selecao'}
            }, status=400)

        responsavel = Funcionario.objects.filter(id=responsavel_id, ativo=True).first()
        if not responsavel:
            return JsonResponse({
                'success': False,
                'message': 'Responsavel invalido na selecao',
                'errors': {'responsavel': 'Responsavel invalido na selecao'}
            }, status=400)

        if responsavel.id not in {participante.id for participante in participantes}:
            return JsonResponse({
                'success': False,
                'message': 'O responsavel precisa estar entre os participantes',
                'errors': {'responsavel': 'O responsavel precisa estar entre os participantes'}
            }, status=400)

        participantes_ids_set = {participante.id for participante in participantes}
        assinaturas_existentes_ids = set(
            dds.assinaturas.filter(funcionario_id__in=participantes_ids_set)
            .values_list('funcionario_id', flat=True)
        )
        assinaturas_ids_set = assinaturas_existentes_ids.union(set(assinaturas_por_funcionario.keys()))
        if participantes_ids_set != assinaturas_ids_set:
            return JsonResponse({
                'success': False,
                'message': 'Todos os participantes devem assinar a DDS',
                'errors': {'assinaturas': 'Todos os participantes devem assinar a DDS'}
            }, status=400)

        with transaction.atomic():
            dds.titulo = data.get('titulo', '').strip()
            dds.data = data.get('data')
            dds.horario = data.get('horario')
            dds.responsavel = responsavel
            dds.full_clean()
            dds.save()
            dds.participantes.set(participantes)
            dds.assinaturas.exclude(funcionario_id__in=participantes_ids_set).delete()
            salvar_assinaturas_dds(dds, assinaturas_por_funcionario)

        return JsonResponse({
            'success': True,
            'message': 'DDS atualizada com sucesso!',
            'dds': serializar_dds(dds)
        }, status=200)

    except ValidationError as e:
        return JsonResponse({
            'success': False,
            'message': 'Erro de validacao',
            'errors': e.message_dict
        }, status=400)
    except Exception as e:
        print('Stack trace:', traceback.format_exc())
        return JsonResponse({
            'success': False,
            'message': 'Erro ao atualizar DDS',
            'errors': str(e)
        }, status=500)


@login_required
@require_http_methods(["GET"])
def exportar_dds_pdf(request, id):
    dds = (
        DDS.objects.select_related('responsavel', 'criado_por')
        .prefetch_related('participantes', 'assinaturas__funcionario')
        .filter(id=id)
        .first()
    )
    if not dds:
        return JsonResponse({
            'success': False,
            'message': 'DDS nao encontrada'
        }, status=404)

    pdf_buffer = build_dds_pdf(dds)
    response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="dds-{dds.id}.pdf"'
    return response
    
@login_required
def itens_ativos_funcionario(request,id):
    if request.method == 'GET':
        try:
            if not request.user.is_superuser: 
                if request.user.funcionario.id != id and not request.user.funcionario.tipo_acesso == 'master':
                    return JsonResponse({'error': 'Acesso negado'}, status=403)
            # itens_ativos = DadosSolicitacao.objects.filter(solicitacao__status='Entregue',solicitacao__funcionario=id,dados_solicitacao_devolucao=None).order_by("-solicitacao__data_atualizacao")

            itens_ativos = ( DadosSolicitacao.objects
            .select_related('solicitacao','equipamento')
            .prefetch_related('dados_solicitacao_devolucao')
            .annotate(
                total_devolvido=Sum('dados_solicitacao_devolucao__quantidade_devolvida')
            ).filter(
                solicitacao__status='Entregue',
                solicitacao__funcionario=id
            ).filter(
                Q(total_devolvido__isnull=True) | Q(total_devolvido__lt=F('quantidade'))
            ).order_by('-solicitacao__data_atualizacao')
            )

            # print(itens_ativos)

            lista_itens_ativos = []
            for item in itens_ativos:
                lista_itens_ativos.append({
                    'id': item.id,
                    'solicitacao_id': item.solicitacao.id,
                    'equipamento_id': item.equipamento.id,
                    'equipamento_nome': item.equipamento.nome,
                    'equipamento_codigo': item.equipamento.codigo,
                    'quantidade': item.quantidade,
                    'data_recebimento': item.solicitacao.data_atualizacao.date().strftime('%d/%m/%Y'),
                    'quantidade_devolvida_original': item.total_devolvido or 0,
                    'quantidade_disponivel': item.quantidade - (item.total_devolvido or 0),
                })
            #puxar todos os itens entregues que o funcionario possui
            if lista_itens_ativos:
                return JsonResponse(lista_itens_ativos, safe=False)
            else:
                return JsonResponse(lista_itens_ativos,status=404,safe=False)
        except (AttributeError, ObjectDoesNotExist) as e:
            traceback.print_exc()
            return JsonResponse({'error': 'Erro ao acessar dados relacionados: ' + str(e)}, status=500)

        except DatabaseError as e:
            traceback.print_exc()
            return JsonResponse({'error': 'Erro no banco de dados: ' + str(e)}, status=500)

        except Exception as e:
            traceback.print_exc()
            return JsonResponse({'error': 'Erro inesperado: ' + str(e)}, status=500)
    
@login_required
def inventario(request):
    if request.method == 'GET':
        return render(request, 'usuario/inventario.html', {"funcionario":request.user.funcionario})
