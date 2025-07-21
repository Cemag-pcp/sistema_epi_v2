from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db import transaction
from django.db.models import Q, Sum
from usuario.decorators import somente_master
from usuario.models import Funcionario
from solicitacao.models import Solicitacao, DadosSolicitacao, Assinatura
from equipamento.models import Equipamento
from devolucao.models import Devolucao
from django.core.files.base import ContentFile
import json
import base64
import uuid
import traceback
from datetime import timedelta, datetime

# Create your views here.

@login_required
@somente_master
def home(request):
    return render(request, 'home.html')

@login_required
@somente_master
def home_solicitacoes(request):
    # Parâmetros de paginação e ordenação
    page = int(request.GET.get('page', 1))
    per_page = int(request.GET.get('per_page', 10))
    search = request.GET.get('search', '')
    id_solicitacao = request.GET.get('id_solicitacao', '')
    funcionario = request.GET.get('funcionario', '')
    equipamento = request.GET.get('equipamento', '')
    data_inicio = request.GET.get('data_inicio', '')
    data_fim = request.GET.get('data_fim', '')
    status = request.GET.get('status', '').split(',')
    sort_field = request.GET.get('sort', 'data_solicitacao')
    order = request.GET.get('order', 'desc')

    # Consulta base
    query = Solicitacao.objects.select_related(
        'funcionario', 'solicitante'
    ).prefetch_related(
        'dados_solicitacao__equipamento'
    )

    # Aplica filtros
    if search:
        query = query.filter(
            Q(id__icontains=search) |
            Q(funcionario__nome__icontains=search) |
            Q(funcionario__matricula__icontains=search) |
            Q(dados_solicitacao__equipamento__nome__icontains=search)
        ).distinct()
    
    if id_solicitacao:
        query = query.filter(id__icontains=id_solicitacao)

    if funcionario:
        query = query.filter(
            Q(funcionario__nome__icontains=funcionario) |
            Q(funcionario__matricula__icontains=funcionario)
        ).distinct()

    if equipamento:
        query = query.filter(
            dados_solicitacao__equipamento__nome__icontains=equipamento
        ).distinct()

    if data_inicio:
        data_inicio = datetime.strptime(data_inicio, '%Y-%m-%d').date()
        query = query.filter(data_solicitacao__gte=data_inicio)

    if data_fim:
        data_fim = datetime.strptime(data_fim, '%Y-%m-%d').date()
        # Adiciona 1 dia para incluir o dia inteiro
        data_fim += timedelta(days=1)
        query = query.filter(data_solicitacao__lt=data_fim)

    if status and status != ['']:
        query = query.filter(status__in=status)

    # Mapeamento de campos de ordenação
    field_mapping = {
        'data_solicitacao': 'data_solicitacao',
        'funcionario': 'funcionario__nome',
        'matricula': 'funcionario__matricula',
        'status': 'status',
    }
    
    # Verifica se o campo de ordenação existe no mapeamento
    sort_field = field_mapping.get(sort_field, sort_field)
    
    # Ordenação
    if order == 'desc':
        sort_field = f'-{sort_field}'
    query = query.order_by(sort_field)

    # Total de registros (antes da paginação)
    total_count = query.count()

    # Paginação
    paginator = Paginator(query, per_page)
    try:
        solicitacoes = paginator.page(page)
    except PageNotAnInteger:
        solicitacoes = paginator.page(1)
    except EmptyPage:
        solicitacoes = paginator.page(paginator.num_pages)

    # Estrutura de resposta
    dados_formatados = []
    for solicitacao in solicitacoes:
        # Obtém todos os itens da solicitação
        itens = []
        for dado in solicitacao.dados_solicitacao.all():
            itens.append({
                'quantidade': dado.quantidade,
                'motivo': dado.motivo,
                'observacoes': dado.observacoes,
                'equipamento_id': dado.equipamento.id,
                'equipamento_codigo': dado.equipamento.codigo,
                'equipamento_nome': dado.equipamento.nome,
            })

        dados_formatados.append({
            'id': solicitacao.id,
            'solicitacao_id': solicitacao.id,
            'data_solicitacao': solicitacao.data_solicitacao.isoformat(),
            'funcionario_id': solicitacao.funcionario.id,
            'funcionario_matricula': solicitacao.funcionario.matricula,
            'funcionario_nome': solicitacao.funcionario.nome,
            'status_assinatura': solicitacao.status,
            'solicitante_matricula': solicitacao.solicitante.matricula,
            'solicitante_nome': solicitacao.solicitante.nome,
            'itens': itens,
            'observacoes_gerais': solicitacao.observacoes,
        })

    return JsonResponse({
        'dados_solicitados': dados_formatados,
        'total_itens': total_count,
        'page': page,
        'per_page': per_page
    })

@login_required
@somente_master
@require_http_methods(["GET", "PATCH", "PUT"])
def alter_solicitacao(request, id):

    if request.method == 'GET':
        try:
            solicitacao = Solicitacao.objects.select_related(
                'funcionario', 'solicitante'
            ).prefetch_related(
                'dados_solicitacao__equipamento'
            ).get(id=id)
            
            equipamentos = Equipamento.objects.filter(ativo=True).values('id', 'nome', 'codigo').order_by("id")
        
            dados_solicitacao = []
            for dado in solicitacao.dados_solicitacao.all():
                dados_solicitacao.append({
                    'id': dado.id,
                    'equipamento_id': dado.equipamento.id,
                    'equipamento_nome': dado.equipamento.nome,
                    'quantidade': dado.quantidade,
                    'motivo': dado.motivo,
                    'observacoes': dado.observacoes,
                })
            
            return JsonResponse({
                'success': True,
                'solicitacao': {
                    'id': solicitacao.id,
                    'status': solicitacao.status,
                    'solicitante_id': solicitacao.solicitante.id if solicitacao.solicitante else None,
                    'solicitante_nome': solicitacao.solicitante.nome if solicitacao.solicitante else None,
                    'funcionario_id': solicitacao.funcionario.id if solicitacao.funcionario else None,
                    'funcionario_nome': solicitacao.funcionario.nome if solicitacao.funcionario else None,
                    'funcionario_matricula': solicitacao.funcionario.matricula if solicitacao.funcionario else None,
                    'data_solicitacao': solicitacao.data_solicitacao.strftime("%Y-%m-%d %H:%M:%S"),
                    'observacoes_gerais': solicitacao.observacoes,
                    'dados_solicitacao': dados_solicitacao
                },
                'equipamentos': list(equipamentos),
                'funcionarios_disponiveis': list(Funcionario.objects.filter(ativo=True).values('id', 'matricula', 'nome')),
                'motivos': list(DadosSolicitacao.REASON_CHOICES)
            }, status=200)
            
        except Solicitacao.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Solicitação não encontrada'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)

    elif request.method == 'PATCH':
        try:
            # Implementação do método PATCH aqui
            solicitacao = Solicitacao.objects.get(id=id)

            if solicitacao.status == 'Pendente':
                solicitacao.status = 'Cancelado'
                solicitacao.save()
            elif solicitacao.status == 'Cancelado':
                solicitacao.status = 'Pendente'
                solicitacao.save()
            else:
                return JsonResponse({'success': False, 'message': 'Solicitação não pode ser cancelada pois já foi entregue'}, status=404)
            
            return JsonResponse({'success': True, 'message': 'Solicitação atualizada com sucesso'}, status=200)
            
        except Solicitacao.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Solicitação não encontrada'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)
    
    elif request.method == 'PUT':
        try:
            with transaction.atomic():
                solicitacao = Solicitacao.objects.get(id=id)
                data = json.loads(request.body)
                
                # Processar dados_solicitacao se existir no payload
                if 'dados_solicitacao' in data:
                    # Obter IDs dos equipamentos que serão mantidos/atualizados
                    novos_equipamentos_ids = [dado['equipamento_id'] for dado in data['dados_solicitacao']]
                    
                    # Deletar apenas os DadosSolicitacao que não estão no novo payload
                    DadosSolicitacao.objects.filter(
                        solicitacao=solicitacao
                    ).exclude(
                        equipamento_id__in=novos_equipamentos_ids
                    ).delete()
                    
                    # Atualizar ou criar os novos DadosSolicitacao
                    for dado in data['dados_solicitacao']:
                        DadosSolicitacao.objects.update_or_create(
                            solicitacao=solicitacao,
                            equipamento_id=dado['equipamento_id'],
                            defaults={
                                'quantidade': dado['quantidade'],
                                'motivo': dado['motivo'],
                                'observacoes': dado.get('observacoes', '')
                            }
                        )
                
                return JsonResponse({
                    'success': True, 
                    'message': 'Solicitação atualizada com sucesso',
                    'solicitacao_id': solicitacao.id
                }, status=200)
        
        except Solicitacao.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Solicitação não encontrada'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=400)
        
@login_required
@somente_master
@require_http_methods(["POST"])
def send_signature(request):

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            print(data)
            
            if not all(key in data for key in ['signature', 'solicitacao_id', 'equipamentos']):
                return JsonResponse({'success': False, 'message': 'Dados incompletos'}, status=400)

            with transaction.atomic():
                try:
                    solicitacao = Solicitacao.objects.select_for_update().get(id=data['solicitacao_id'])
                except Solicitacao.DoesNotExist:
                    return JsonResponse({'success': False, 'message': 'Solicitação não encontrada'}, status=404)

                format, imgstr = data['signature'].split(';base64,') 
                ext = format.split('/')[-1]
                file_name = f"{uuid.uuid4()}.{ext}"
                assinatura_path = ContentFile(base64.b64decode(imgstr), name=file_name)

                assinatura = Assinatura.objects.create(
                    solicitacao=solicitacao,
                    imagem_assinatura=assinatura_path
                )

                if not assinatura.imagem_assinatura:
                    raise Exception("Campo de assinatura vazio após criação.")
                
                try:
                    print("URL da assinatura:", assinatura.imagem_assinatura.url)
                except Exception as e:
                    raise Exception(f"Erro ao acessar URL da assinatura: {str(e)}")

                for equipamento_data in data['equipamentos']:
                    equipamento_id = equipamento_data['equipamento_id']
                    qualidade = equipamento_data['condicao'].lower()  # deve estar entre 'bom', 'ruim', 'danificado'

                    try:
                        dados_solicitacao = DadosSolicitacao.objects.annotate(
                            total_devolvido=Sum('dados_solicitacao_devolucao__quantidade_devolvida')
                        ).get(
                            pk=equipamento_data['id'] # Esse id é do DadosSolicitacao associado ao equipamento
                        )


                        # Validando o que já foi devolvido
                        total_ja_devolvido = dados_solicitacao.total_devolvido or 0

                        # Pegando a quantidade disponível para devolução
                        quantidade_disponivel = dados_solicitacao.quantidade - total_ja_devolvido

                        # Validando a quantidade devolvida
                        if int(equipamento_data['quantidade_devolvida']) <= 0:
                            raise ValueError("Quantidade devolvida deve ser maior que zero!")
                        # Quantidade devolvida não pode ser maior que a quantidade disponível

                        if int(equipamento_data['quantidade_devolvida']) > quantidade_disponivel:
                            raise ValueError(f"Quantidade devolvida ({equipamento_data['quantidade_devolvida']}) maior que a disponível ({quantidade_disponivel})!")
                        
                    except DadosSolicitacao.DoesNotExist:
                            raise Exception(f"DadosSolicitacao não encontrado para equipamento {equipamento_id}")

                    # Criação da devolução
                    Devolucao.objects.create(
                        dados_solicitacao=dados_solicitacao,
                        responsavel_recebimento=request.user,
                        estado_item=qualidade,  # deve estar de acordo com os choices
                        quantidade_devolvida=int(equipamento_data['quantidade_devolvida']),
                    )

                assinatura.save()
                solicitacao.status = 'Entregue'
                solicitacao.save()

                return JsonResponse({'success': True, 'message': 'Assinatura e devoluções registradas com sucesso'}, status=200)

        except Exception as e:
            traceback.print_exc()
            return JsonResponse({'success': False, 'message': str(e)}, status=500)

@login_required
@somente_master
@require_http_methods(["DELETE", "PUT"])
def alter_signature(request, id):

    if request.method == 'DELETE':
        try:
            with transaction.atomic():
                solicitacao = Solicitacao.objects.filter(id=id).first()
                if not solicitacao:
                    return JsonResponse({'success': False, 'message': 'Solicitação não encontrada.'}, status=404)

                # Tenta buscar a assinatura
                assinatura = Assinatura.objects.filter(solicitacao=solicitacao).first()
                if not assinatura:
                    return JsonResponse({'success': False, 'message': 'Assinatura não encontrada para esta solicitação.'}, status=404)

                # Filtra todas as devoluções relacionadas aos dados da solicitação
                devolucoes = Devolucao.objects.filter(dados_solicitacao__solicitacao=solicitacao)
                devolucoes_count = devolucoes.count()
                devolucoes.delete()

                # Deleta a assinatura (isso também muda o status para "Pendente")
                assinatura.delete()

                return JsonResponse({
                    'success': True,
                    'message': 'Assinatura e devoluções excluídas com sucesso.',
                    'devolucoes_removidas': devolucoes_count
                }, status=200)

        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Ocorreu um erro ao excluir a assinatura e as devoluções: {str(e)}'
            }, status=500)
        
def dashboard_template(request):
    return render(request, 'dashboard.html') 

def dashboard(request):
    if not request.user.is_authenticated:
        return JsonResponse({
            'status': 'error',
            'message': 'Autenticação necessária'
        }, status=401)

    try:
        page_number = request.GET.get('page', 1)
        items_per_page = 10

        solicitacoes_pendentes = Solicitacao.objects.filter(status='Pendente').prefetch_related('dados_solicitacao').order_by('-data_solicitacao')
        
        paginator = Paginator(solicitacoes_pendentes, items_per_page)
        page_obj = paginator.get_page(page_number)
        
        dados = []
        for solicitacao in page_obj:
            itens = []
            for dado in solicitacao.dados_solicitacao.all():
                itens.append({
                    'equipamento': dado.equipamento.nome,
                    'quantidade': dado.quantidade,
                    'motivo': dado.get_motivo_display(),
                    'observacoes': dado.observacoes or ''
                })
            
            dados.append({
                'id': solicitacao.id,
                'solicitante': solicitacao.solicitante.nome,
                'funcionario': solicitacao.funcionario.nome,
                'data_solicitacao': (solicitacao.data_solicitacao - timedelta(hours=3)).strftime('%d/%m/%Y %H:%M'),
                'timestamp_solicitacao': int(solicitacao.data_solicitacao.timestamp()),
                'status': solicitacao.get_status_display(),
                'observacoes': solicitacao.observacoes or '',
                'itens': itens
            })
        
        return JsonResponse({
            'status': 'success',
            'solicitacoes': dados,
            'pagination': {
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous(),
                'current_page': page_obj.number,
                'total_pages': paginator.num_pages,
                'total_items': paginator.count
            }
        })

    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)