from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator, PageNotAnInteger, EmptyPage
from django.db import transaction
from django.db.models import Prefetch, Q
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from usuario.decorators import somente_master, master_solicit
from .models import Padrao, PadraoFuncionario, PadraoEquipamento
from equipamento.models import Equipamento
from usuario.models import Funcionario
import json


@login_required
@master_solicit
def padroes_view(request):
    return render(request, "padroes.html")

@login_required
@master_solicit
@require_http_methods(["GET", "POST"])
def padroes(request):
    if request.method == "GET":
        page = request.GET.get('page', 1)
        per_page = 10
        search_term = request.GET.get('search', '').strip()
        status_filter = request.GET.get('status', '')
        sort_column = request.GET.get('sort', 'id')
        sort_order = request.GET.get('order', 'asc')

        # Query base
        if request.user.is_superuser:
            padroes_queryset = Padrao.objects.all().select_related("setor").prefetch_related(
                'funcionarios',
                Prefetch(
                    'padraofuncionario_set',
                    queryset=PadraoFuncionario.objects.select_related('funcionario').prefetch_related(
                        Prefetch(
                            'equipamentos',
                            queryset=PadraoEquipamento.objects.select_related('equipamento')
                        )
                    )
                )
            )
        else:
            padroes_queryset = Padrao.objects.filter(setor=request.user.funcionario.setor).select_related("setor").prefetch_related(
                'funcionarios',
                Prefetch(
                    'padraofuncionario_set',
                    queryset=PadraoFuncionario.objects.select_related('funcionario').prefetch_related(
                        Prefetch(
                            'equipamentos',
                            queryset=PadraoEquipamento.objects.select_related('equipamento')
                        )
                    )
                )
            )

        # Aplicar filtros
        if search_term:
            padroes_queryset = padroes_queryset.filter(
                Q(nome__icontains=search_term) | 
                Q(id__icontains=search_term)
            )

        if status_filter:
            if status_filter == 'Ativo':
                padroes_queryset = padroes_queryset.filter(ativo=True)
            elif status_filter == 'Desativado':
                padroes_queryset = padroes_queryset.filter(ativo=False)

        # Mapeamento de colunas para campos do modelo
        sort_mapping = {
            'nome': 'nome',
            'setor_nome': 'setor__nome',
            'ativo': 'ativo',
            'data_criacao': 'data_criacao',
            'id': 'id'
        }

        # Aplicar ordenação
        sort_field = sort_mapping.get(sort_column, 'id')
        if sort_order == 'desc':
            sort_field = f'-{sort_field}'
        
        padroes_queryset = padroes_queryset.order_by(sort_field)

        # Paginação
        paginator = Paginator(padroes_queryset, per_page)
        
        try:
            padroes_pagina = paginator.get_page(page)
        except PageNotAnInteger:
            padroes_pagina = paginator.get_page(1)
        except EmptyPage:
            padroes_pagina = paginator.get_page(paginator.num_pages)

        # Serialização dos dados
        padroes_data = []
        for padrao in padroes_pagina:
            funcionarios_data = []
            total_itens = 0
            
            for pf in padrao.padraofuncionario_set.all():
                itens = []
                for equipamento in pf.equipamentos.all():
                    itens.append({
                        "nome": equipamento.equipamento.nome,
                        "quantidade": equipamento.quantidade
                    })
                
                total_itens += len(itens)
                
                funcionarios_data.append({
                    "matricula": pf.funcionario.matricula,
                    "nome": pf.funcionario.nome,
                    "itens": itens
                })

            padroes_data.append({
                "id": padrao.id,
                "nome": padrao.nome,
                "setor_nome": padrao.setor.nome,
                "funcionarios": funcionarios_data,
                "ativo": padrao.ativo,
                "data_criacao": padrao.data_criacao.strftime("%d/%m/%Y %H:%M"),
                "data_atualizacao": padrao.data_atualizacao.strftime("%d/%m/%Y %H:%M") if padrao.data_atualizacao else None,
                "total_itens": total_itens
            })
        
        return JsonResponse({
            'padroes': padroes_data,
            'has_next': padroes_pagina.has_next(),
            'current_page': page,
            'total_pages': paginator.num_pages,
            'total_count': paginator.count  # Útil para mostrar total de registros
        })

    if request.method == "POST":
        try:
            data = json.loads(request.body)
        
            # Validar dados básicos
            if not data.get('nome') or not data.get('setor_id'):
                return JsonResponse({'success': False, 'message': 'Nome e setor são obrigatórios'}, status=400)
            
            if not data.get('funcionarios') or len(data['funcionarios']) == 0:
                return JsonResponse({'success': False, 'message': 'Pelo menos um funcionário é necessário'}, status=400)
            
            with transaction.atomic():

                if Padrao.objects.filter(nome=data.get('nome'), setor__id=data.get('setor_id')).exists():
                    return JsonResponse({
                        'success': False,
                        'message': 'Já existe um padrão com este nome no mesmo setor'
                    }, status=400)

                # Criar o padrão
                padrao = Padrao.objects.create(
                    nome=data['nome'],
                    setor_id=data['setor_id']
                )
                
                # Processar cada funcionário e seus equipamentos
                for func_data in data['funcionarios']:
                    # Criar relação Padrao-Funcionario
                    padrao_func = PadraoFuncionario.objects.create(
                        padrao=padrao,
                        funcionario_id=func_data['funcionario_id']
                    )
                    
                    # Adicionar equipamentos do funcionário
                    for equip_data in func_data['equipamentos']:
                        PadraoEquipamento.objects.create(
                            padrao_funcionario=padrao_func,
                            equipamento_id=equip_data['equipamento_id'],
                            quantidade=equip_data['quantidade'],
                            observacoes=equip_data.get('observacoes', ''),
                            motivo=equip_data.get('motivo', '')
                        )
                
                return JsonResponse({
                    'success': True,
                    'message': 'Padrão criado com sucesso',
                    'padrao_id': padrao.id
                })

        except ValidationError as e:
            return JsonResponse(
                {
                    "success": False,
                    "message": "Erro de validação",
                    "errors": e.message_dict,
                },
                status=400,
            )

        except Exception as e:
            return JsonResponse(
                {
                    "success": False,
                    "message": str(e),
                    "detail": "Erro interno no servidor",
                },
                status=500,
            )

@login_required
@master_solicit
@require_http_methods(["GET", "PUT", "PATCH"])
def alter_padrao(request, id):
    try:
        padrao = Padrao.objects.filter(id=id).first()
        
        if not padrao:
            return JsonResponse(
                {'success': False, 'message': 'Equipamento não encontrado'}, 
                status=404
            )
        
        if request.method == 'GET':
            try:
                padrao = Padrao.objects.get(id=id)
                
                # Obter todos os equipamentos disponíveis
                equipamentos = Equipamento.objects.filter(ativo=True).values('id', 'nome', 'codigo')
                
                if request.user.is_superuser:
                    funcionarios = Funcionario.objects.filter(setor=padrao.setor,ativo=True).values('id', 'matricula', 'nome')
                else:
                    funcionarios = Funcionario.objects.filter(setor=request.user.funcionario.setor, ativo=True).values('id', 'matricula', 'nome')
                
                # Obter dados do padrão específico
                padrao_funcionarios = []
                for pf in padrao.padraofuncionario_set.all():
                    equipamentos_funcionario = []
                    for pe in pf.equipamentos.all():
                        equipamentos_funcionario.append({
                            'equipamento_id': pe.equipamento.id,
                            'nome': pe.equipamento.nome,
                            'quantidade': pe.quantidade,
                            'motivo': pe.motivo,
                            'observacoes': pe.observacoes,
                        })
                    
                    padrao_funcionarios.append({
                        'funcionario_id': pf.funcionario.id,
                        'matricula': pf.funcionario.matricula,
                        'nome': pf.funcionario.nome,
                        'equipamentos': equipamentos_funcionario
                    })
                
                return JsonResponse({
                    'success': True,
                    'padrao': {
                        'id': padrao.id,
                        'nome': padrao.nome,
                        'setor_id': padrao.setor.id,
                        'setor_nome': padrao.setor.nome,
                        'funcionarios': padrao_funcionarios,
                        'data_criacao': padrao.data_criacao.strftime("%Y-%m-%d %H:%M:%S")
                    },
                    'equipamentos': list(equipamentos),
                    'funcionarios_disponiveis': list(funcionarios),
                }, status=200)
                
            except Padrao.DoesNotExist:
                return JsonResponse({'success': False, 'message': 'Padrão não encontrado'}, status=404)
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)}, status=500)

        if request.method == 'PUT':
            try:
                data = json.loads(request.body)
                padrao_nome = data.get('padrao_nome')
                padrao_id = data.get('padrao_id')
                requests = data.get('requests', [])
                
                with transaction.atomic():
                    padrao = Padrao.objects.select_for_update().get(id=padrao_id)

                    if padrao_nome != padrao.nome:
                        if Padrao.objects.filter(nome=padrao_nome, setor=padrao.setor).exists():
                            return JsonResponse({
                                'success': False,
                                'message': 'Já existe um padrão com este nome no mesmo setor'
                            }, status=400)
                        
                        padrao.nome = padrao_nome
                    
                    # Limpar associações existentes de forma atômica
                    PadraoFuncionario.objects.filter(padrao=padrao).delete()
                    
                    # Dicionário para agrupar equipamentos por funcionário
                    funcionarios_equipamentos = {}
                    
                    # Agrupar equipamentos por funcionário
                    for req in requests:
                        funcionario_id = req['operator_id']
                        if funcionario_id not in funcionarios_equipamentos:
                            funcionarios_equipamentos[funcionario_id] = []
                        funcionarios_equipamentos[funcionario_id].append({
                            'equipamento_id': req['item_id'],
                            'quantidade': req['quantity'],
                            'observacoes': req.get('observation', ''),
                            'motivo': req.get('motivo', '')
                        })
                    
                    # Criar novas associações
                    for funcionario_id, equipamentos in funcionarios_equipamentos.items():
                        try:
                            funcionario = Funcionario.objects.get(id=funcionario_id)
                            padrao_func = PadraoFuncionario.objects.create(
                                padrao=padrao,
                                funcionario=funcionario
                            )
                            
                            for equip in equipamentos:
                                equipamento = Equipamento.objects.get(id=equip['equipamento_id'])
                                PadraoEquipamento.objects.create(
                                    padrao_funcionario=padrao_func,
                                    equipamento=equipamento,
                                    quantidade=equip['quantidade'],
                                    motivo=equip['motivo'],
                                    observacoes=equip['observacoes']
                                )
                        
                        except (Funcionario.DoesNotExist, Equipamento.DoesNotExist) as e:
                            raise Exception(f'Funcionário ou equipamento não encontrado: {str(e)}')
                    
                    padrao.save()
                    
                return JsonResponse({
                    'success': True,
                    'message': 'Padrão atualizado com sucesso',
                    'padrao_id': padrao.id
                })
                
            except Padrao.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'message': 'Padrão não encontrado'
                }, status=404)
            except Exception as e:
                return JsonResponse({
                    'success': False,
                    'message': str(e)
                }, status=500)

        elif request.method == 'PATCH':
            try:
                padrao.ativo = not padrao.ativo
                padrao.save()
                
                return JsonResponse({
                    'success': True, 
                    'message': f'Equipamento {"ativado" if padrao.ativo else "desativado"} com sucesso',
                    'novo_status': padrao.ativo
                })
                
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
@require_http_methods(["GET"])
def equipaments_padrao(request):

    if request.method == 'GET':

        equipamentos = list(Equipamento.objects.filter(ativo=True).values("id","codigo","nome").order_by("id"))

        motivos = [{'id': reason[0], 'nome': reason[1]} for reason in PadraoEquipamento.REASON_CHOICES]

        return JsonResponse({'equipamentos':equipamentos, 'motivos':motivos}, status=200)
    