from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.db.models import Prefetch
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from usuario.decorators import somente_master
from .models import Padrao, PadraoFuncionario, PadraoEquipamento
from equipamento.models import Equipamento
from usuario.models import Funcionario
import json


@login_required
@somente_master
@require_http_methods(["GET", "POST"])
def padroes(request):
    if request.method == "GET":
        # Obtém todos os padrões com seus relacionamentos
        todos_padroes = (
            Padrao.objects.all()
            .order_by("id")
            .select_related("setor")
            .prefetch_related(
                'funcionarios',
                Prefetch(
                    'padraofuncionario_set',
                    queryset=PadraoFuncionario.objects.select_related('funcionario')
                    .prefetch_related(
                        Prefetch(
                            'equipamentos',
                            queryset=PadraoEquipamento.objects.select_related('equipamento')
                        )
                    )
                )
            )
        )

        padroes = []
        for padrao in todos_padroes:
            funcionarios_data = []
            total_itens = 0
            
            # Para cada relação PadraoFuncionario
            for pf in padrao.padraofuncionario_set.all():
                itens = []
                # Para cada equipamento do funcionário neste padrão
                for equipamento in pf.equipamentos.all():
                    itens.append({
                        "nome": equipamento.equipamento.nome,
                        "quantidade": equipamento.quantidade
                    })
                
                total_itens += len(itens)  # Adiciona ao total geral
                
                funcionarios_data.append({
                    "matricula": pf.funcionario.matricula,
                    "nome": pf.funcionario.nome,
                    "itens": itens
                })

            padroes.append({
                "id": padrao.id,
                "nome": padrao.nome,
                "setor_nome": padrao.setor.nome,
                "funcionarios": funcionarios_data,
                "ativo": padrao.ativo,
                "data_criacao": padrao.data_criacao,
                "data_atualizacao": padrao.data_atualizacao,
                "total_itens": total_itens  # Usa o total calculado
            })

        return render(request, "padroes.html", {"padroes": padroes})

    if request.method == "POST":
        try:
            data = json.loads(request.body)

            # Validação básica
            required_fields = ["nome", "codigo"]
            if not all(field in data for field in required_fields):
                return JsonResponse(
                    {
                        "success": False,
                        "message": "Campos obrigatórios faltando",
                        "errors": {
                            field: "Este campo é obrigatório"
                            for field in required_fields
                            if field not in data
                        },
                    },
                    status=400,
                )

            # Cria o novo equipamento
            equipamento = Padrao(
                nome=data["nome"],
                codigo=data["codigo"],
                vida_util_dias=data["vida_util_dias"],
                ca=data["ca"],
                ativo=data.get("ativo", True),
            )

            equipamento.full_clean()
            equipamento.save()

            return JsonResponse(
                {
                    "success": True,
                    "message": "Equipamento criado com sucesso",
                    "equipamento": {
                        "id": equipamento.id,
                        "nome": equipamento.nome,
                        "codigo": equipamento.codigo,
                        "vida_util_dias": equipamento.vida_util_dias,
                        "ca": equipamento.ca,
                        "ativo": equipamento.ativo,
                    },
                }
            )

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
@somente_master
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
                equipamentos = Equipamento.objects.filter(ativo=True).values('id', 'nome')
                
                # Obter todos os funcionários disponíveis
                funcionarios = Funcionario.objects.filter(ativo=True).values('id', 'matricula', 'nome')
                
                # Obter dados do padrão específico
                padrao_funcionarios = []
                for pf in padrao.padraofuncionario_set.all():
                    equipamentos_funcionario = []
                    for pe in pf.equipamentos.all():
                        equipamentos_funcionario.append({
                            'equipamento_id': pe.equipamento.id,
                            'nome': pe.equipamento.nome,
                            'quantidade': pe.quantidade
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
                data = json.loads(request.body) if request.body else {}
                
                # Validação básica dos campos
                required_fields = ['nome', 'codigo', 'vida_util_dias', 'ca']
                if not all(field in data for field in required_fields):
                    return JsonResponse(
                        {'success': False, 'message': 'Campos obrigatórios faltando'},
                        status=400
                    )

                return JsonResponse({
                    'success': True, 
                    'message': 'Equipamento atualizado com sucesso',
                    'data': {
                        'id': 'equipamento.id',
                        'nome': 'equipamento.nome',
                        'codigo': 'equipamento.codigo',
                        'vida_util_dias': 'equipamento.vida_util_dias',
                        'ca': 'equipamento.ca',
                        'ativo': 'equipamento.ativo'
                    }
                })

            except json.JSONDecodeError:
                return JsonResponse(
                    {'success': False, 'message': 'Formato JSON inválido'},
                    status=400
                )
            except ValidationError as e:
                return JsonResponse(
                    {'success': False, 'message': 'Dados inválidos', 'errors': e.message_dict},
                    status=400
                )
            except ValueError as e:
                return JsonResponse(
                    {'success': False, 'message': str(e)},
                    status=400
                )

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