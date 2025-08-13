from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db import transaction
from django.db.models import Q, Sum, Prefetch
from usuario.decorators import somente_master
from usuario.models import Funcionario
from solicitacao.models import Solicitacao, DadosSolicitacao, Assinatura
from equipamento.models import Equipamento
from devolucao.models import Devolucao
from django.core.files.base import ContentFile
from django.core.serializers.json import DjangoJSONEncoder
from datetime import datetime
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
                
                funcionario = solicitacao.funcionario
                
                # Processar dados_solicitacao se existir no payload
                if 'dados_solicitacao' in data:
                    # Primeiro validar todos os dados antes de fazer qualquer alteração
                    for dado in data['dados_solicitacao']:
                        equipamento_id = dado['equipamento_id']
                        motivo = dado['motivo']
                        
                        try:
                            equipamento = Equipamento.objects.get(id=equipamento_id)
                        except Equipamento.DoesNotExist:
                            return JsonResponse({
                                'success': False,
                                'message': f'Equipamento com ID {equipamento_id} não encontrado'
                            }, status=404)
                        
                        # Verifica se o funcionário já solicitou este equipamento antes (excluindo a própria solicitação atual)
                        ja_solicitou = DadosSolicitacao.objects.filter(
                            solicitacao__funcionario=funcionario,
                            equipamento=equipamento
                        ).exclude(
                            solicitacao=solicitacao
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

def historico(request):
    return render(request, 'historico.html')

def api_historico(request):
    # Paginação
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 25))
    
    # Parâmetros de busca e filtro
    search = request.GET.get('search', '')
    status = request.GET.get('status', '')
    data_inicio = request.GET.get('data_inicio', '')
    data_fim = request.GET.get('data_fim', '')
    ordering = request.GET.get('ordering', '-data_atualizacao')
    action_type = request.GET.get('action_type', '')  # New parameter for action type
    
    # --- Solicitacoes ---
    solicitacoes = Solicitacao.objects.select_related(
        'funcionario', 'solicitante'
    ).prefetch_related(
        'dados_solicitacao__equipamento'
    )
    
    if search:
        solicitacoes = solicitacoes.filter(
            Q(funcionario__nome__icontains=search) |
            Q(dados_solicitacao__equipamento__nome__icontains=search) |
            Q(solicitante__nome__icontains=search) |
            Q(id__icontains=search)  # Allow search by ID
        )

    
    if status and status != 'devolvido':  # Don't filter solicitacoes by 'devolvido'
        solicitacoes = solicitacoes.filter(status=status)
    
    if data_inicio:
        try:
            data_inicio_formatada = datetime.strptime(data_inicio, "%Y-%m-%d")
            solicitacoes = solicitacoes.filter(data_atualizacao__gte=data_inicio_formatada)
        except ValueError:
            pass
    
    if data_fim:
        try:
            data_fim_formatada = datetime.strptime(data_fim, "%Y-%m-%d")
            solicitacoes = solicitacoes.filter(data_atualizacao__lte=data_fim_formatada)
        except ValueError:
            pass
    
    solicitacoes = solicitacoes.order_by(ordering)
    
    # --- Devolucoes ---
    devolucoes = Devolucao.objects.select_related(
        'dados_solicitacao__solicitacao__funcionario',
        'dados_solicitacao__equipamento',
        'responsavel_recebimento'
    )
    
    if search:
        devolucoes = devolucoes.filter(
            Q(dados_solicitacao__equipamento__nome__icontains=search) |
            Q(dados_solicitacao__solicitacao__funcionario__nome__icontains=search) |
            Q(responsavel_recebimento__nome__icontains=search)
        )
    
    # Only include devolucoes if status is 'devolvido' or no status filter
    if status and status != 'devolvido':
        devolucoes = devolucoes.none()  # Exclude all devolucoes
    
    if data_inicio:
        try:
            data_inicio_formatada = datetime.strptime(data_inicio, "%Y-%m-%d")
            devolucoes = devolucoes.filter(data_devolucao__gte=data_inicio_formatada)
        except ValueError:
            pass
    
    if data_fim:
        try:
            data_fim_formatada = datetime.strptime(data_fim, "%Y-%m-%d")
            devolucoes = devolucoes.filter(data_devolucao__lte=data_fim_formatada)
        except ValueError:
            pass
    
    # Ordenar devoluções pela data também
    if ordering.startswith('-'):
        devolucoes = devolucoes.order_by('-data_devolucao')
    else:
        devolucoes = devolucoes.order_by('data_devolucao')
    
    # --- Transform to Historical Entries (BEFORE pagination) ---
    def transform_to_historical_entries():
        historical_entries = []
        entry_id = 1
        
        # Process solicitacoes
        for solicitacao in solicitacoes:
            for dado in solicitacao.dados_solicitacao.all():
                base_data = {
                    'solicitacao_id': solicitacao.id,
                    'funcionario_id': solicitacao.funcionario.id,
                    'funcionario_matricula': solicitacao.funcionario.matricula,
                    'funcionario_nome': solicitacao.funcionario.nome,
                    'solicitante_matricula': solicitacao.solicitante.matricula,
                    'solicitante_nome': solicitacao.solicitante.nome,
                    'observacoes_gerais': solicitacao.observacoes or '',
                    'equipamento_id': dado.equipamento.id,
                    'equipamento_codigo': dado.equipamento.codigo,
                    'equipamento_nome': dado.equipamento.nome,
                    'quantidade': dado.quantidade,
                    'motivo': dado.motivo,
                }
                
                if (not action_type or action_type == 'request_created'):
                    # 1. Request Created Entry
                    historical_entries.append({
                        'id': f"SOL_{solicitacao.id}_{dado.equipamento.id}_created_{entry_id}",
                        'data_atualizacao': solicitacao.data_solicitacao.isoformat(),
                        'action_type': 'request_created',
                        'status': solicitacao.status,
                        'tipo': 'solicitacao',
                        **base_data
                    })
                    entry_id += 1
                
                # 2. Status Update Entry (if approved)
                # if solicitacao.status.lower() == 'aprovado':
                #     historical_entries.append({
                #         'id': f"SOL_{solicitacao.id}_{dado.equipamento.id}_approved_{entry_id}",
                #         'data_atualizacao': solicitacao.data_atualizacao.isoformat(),
                #         'action_type': 'status_updated',
                #         'status': 'aprovado',
                #         'tipo': 'solicitacao',
                #         **base_data
                #     })
                #     entry_id += 1
                
                # 3. Delivery Entry (if delivered)
                if solicitacao.status.lower() == 'entregue':
                    # Add approval first if not already added
                    # if solicitacao.status.lower() == 'entregue':
                    #     historical_entries.append({
                    #         'id': f"SOL_{solicitacao.id}_{dado.equipamento.id}_approved_{entry_id}",
                    #         'data_atualizacao': solicitacao.data_atualizacao.isoformat(),
                    #         'action_type': 'status_updated',
                    #         'status': 'aprovado',
                    #         'tipo': 'solicitacao',
                    #         **base_data
                    #     })
                    #     entry_id += 1
                    
                    # Add delivery
                    if not action_type or action_type == 'item_delivered':
                        historical_entries.append({
                            'id': f"SOL_{solicitacao.id}_{dado.equipamento.id}_delivered_{entry_id}",
                            'data_atualizacao': solicitacao.data_atualizacao.isoformat(),
                            'action_type': 'item_delivered',
                            'status': 'entregue',
                            'tipo': 'solicitacao',
                            **base_data
                        })
                        entry_id += 1
                    
                    if not action_type or action_type == 'signature_added':
                    # Add signature
                        historical_entries.append({
                            'id': f"SOL_{solicitacao.id}_{dado.equipamento.id}_signed_{entry_id}",
                            'data_atualizacao': solicitacao.data_atualizacao.isoformat(),
                            'action_type': 'signature_added',
                            'status': 'entregue',
                            'tipo': 'solicitacao',
                            **base_data
                        })
                        entry_id += 1
                
                # 4. Cancellation Entry (if canceled)
                if solicitacao.status.lower() == 'cancelado':

                    if not action_type or action_type == 'request_canceled':
                        historical_entries.append({
                            'id': f"SOL_{solicitacao.id}_{dado.equipamento.id}_canceled_{entry_id}",
                            'data_atualizacao': solicitacao.data_atualizacao.isoformat(),
                            'action_type': 'request_canceled',
                            'status': 'cancelado',
                            'tipo': 'solicitacao',
                            **base_data
                        })
                        entry_id += 1
        
        # Process devolucoes
        for devolucao in devolucoes:
            if not action_type or action_type == 'item_returned':
                historical_entries.append({
                    'id': f"DEV_{devolucao.id}_returned_{entry_id}",
                    'solicitacao_id': devolucao.dados_solicitacao.solicitacao.id,
                    'data_atualizacao': devolucao.data_devolucao.isoformat(),
                    'funcionario_id': devolucao.dados_solicitacao.solicitacao.funcionario.id,
                    'funcionario_matricula': devolucao.dados_solicitacao.solicitacao.funcionario.matricula,
                    'funcionario_nome': devolucao.dados_solicitacao.solicitacao.funcionario.nome,
                    'responsavel_recebimento_id': devolucao.responsavel_recebimento.id if devolucao.responsavel_recebimento else None,
                    'responsavel_recebimento_nome': devolucao.responsavel_recebimento.nome if devolucao.responsavel_recebimento else None,
                    'equipamento_id': devolucao.dados_solicitacao.equipamento.id,
                    'equipamento_codigo': devolucao.dados_solicitacao.equipamento.codigo,
                    'equipamento_nome': devolucao.dados_solicitacao.equipamento.nome,
                    'quantidade': devolucao.quantidade_devolvida,
                    'estado_item': devolucao.estado_item,
                    'action_type': 'item_returned',
                    'status': 'Devolvido',
                    'observacoes_gerais': '',
                    'tipo': 'devolucao'
                })
                entry_id += 1
        
        return historical_entries
    
    # Generate all historical entries
    all_historical_entries = transform_to_historical_entries()
    
    # Sort all entries by date
    all_historical_entries.sort(key=lambda x: x['data_atualizacao'], reverse=ordering.startswith('-'))
    
    # NOW apply pagination to the historical entries (not the original solicitacoes)
    total_historical_count = len(all_historical_entries)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_historical_entries = all_historical_entries[start:end]
    
    # Convert back to the format expected by frontend
    dados_formatados = []
    for entry in paginated_historical_entries:
        # Group by solicitacao to create the itens array
        existing_item = None
        for item in dados_formatados:
            if (item['solicitacao_id'] == entry['solicitacao_id'] and 
                item.get('id') == entry['id']):
                existing_item = item
                break
        
        if not existing_item:
            dados_formatados.append({
                'id': entry['id'],
                'solicitacao_id': entry['solicitacao_id'],
                'data_atualizacao': entry['data_atualizacao'],
                'funcionario_id': entry['funcionario_id'],
                'funcionario_matricula': entry['funcionario_matricula'],
                'funcionario_nome': entry['funcionario_nome'],
                'status': entry['status'],
                'solicitante_matricula': entry.get('solicitante_matricula', ''),
                'solicitante_nome': entry.get('solicitante_nome', ''),
                'responsavel_recebimento_id': entry.get('responsavel_recebimento_id'),
                'responsavel_recebimento_nome': entry.get('responsavel_recebimento_nome'),
                'observacoes_gerais': entry['observacoes_gerais'],
                'tipo': entry['tipo'],
                'action_type': entry['action_type'],  # Add this for frontend
                'itens': [{
                    'quantidade': entry['quantidade'],
                    'motivo': entry.get('motivo', ''),
                    'equipamento_id': entry['equipamento_id'],
                    'equipamento_codigo': entry['equipamento_codigo'],
                    'equipamento_nome': entry['equipamento_nome'],
                    'estado_item': entry.get('estado_item'),
                }]
            })
    
    # Calculate pagination info based on historical entries count
    total_pages = (total_historical_count + page_size - 1) // page_size
    has_next = page < total_pages
    has_previous = page > 1
    
    return JsonResponse({
        'dados_solicitados': dados_formatados,
        'total_itens': total_historical_count,  # CORRECT: Total historical entries, not solicitacoes
        'current_page': page,
        'total_pages': total_pages,
        'page_size': page_size,
        'has_next': has_next,
        'has_previous': has_previous,
        'count': total_historical_count,
        'debug_info': {
            'solicitacoes_count': solicitacoes.count(),
            'devolucoes_count': devolucoes.count(),
            'historical_entries_generated': total_historical_count,
            'paginated_entries_returned': len(dados_formatados)
        }
    }, status=200)

        
def dashboard_template(request):
    return render(request, 'dashboard.html') 

def dashboard(request):
    if not request.user.is_authenticated:
        return JsonResponse({
            'status': 'error',
            'message': 'Autenticação necessária'
        }, status=401)

    try:
        # Otimização 1: Prefetch relacionamentos com select_related e Prefetch otimizado
        solicitacoes_pendentes = Solicitacao.objects.filter(
            status='Pendente'
        ).select_related(
            'solicitante', 'funcionario'
        ).prefetch_related(
            Prefetch(
                'dados_solicitacao',
                queryset=DadosSolicitacao.objects.select_related('equipamento')
            )
        ).order_by('-data_solicitacao').only(
            'id', 'data_solicitacao', 'observacoes', 'status',
            'solicitante__nome', 'funcionario__nome'
        )
        
        # Otimização 2: Pré-processar os dados em uma lista de compreensão
        dados = [
            {
                'id': solicitacao.id,
                'solicitante': solicitacao.solicitante.nome,
                'funcionario': solicitacao.funcionario.nome,
                'data_solicitacao': (solicitacao.data_solicitacao - timedelta(hours=3)).strftime('%d/%m/%Y %H:%M'),
                'timestamp_solicitacao': int(solicitacao.data_solicitacao.timestamp()),
                'status': solicitacao.get_status_display(),
                'observacoes': solicitacao.observacoes or '',
                'itens': [
                    {
                        'equipamento': dado.equipamento.nome,
                        'quantidade': dado.quantidade,
                        'motivo': dado.get_motivo_display(),
                        'observacoes': dado.observacoes or ''
                    }
                    for dado in solicitacao.dados_solicitacao.all()
                ]
            }
            for solicitacao in solicitacoes_pendentes
        ]
        
        # Otimização 3: Usar DjangoJSONEncoder para serialização eficiente
        return JsonResponse({
            'status': 'success',
            'solicitacoes': dados
        }, encoder=DjangoJSONEncoder)

    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)