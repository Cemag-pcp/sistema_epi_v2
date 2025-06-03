from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from usuario.decorators import somente_master
from .models import Equipamento
from django.http import JsonResponse
from django.core.exceptions import ValidationError

import json

# Create your views here.

@login_required
@somente_master
@require_http_methods(["GET", "POST"])
def equipamento(request):

    if request.method == 'GET':
        
        equipamentos = list(Equipamento.objects.values().order_by("id"))

        return render(request, 'equipamento.html', {'equipamentos':equipamentos})
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            # Validação básica
            required_fields = ['nome', 'codigo']
            if not all(field in data for field in required_fields):
                return JsonResponse({
                    'success': False,
                    'message': 'Campos obrigatórios faltando',
                    'errors': {field: 'Este campo é obrigatório' for field in required_fields if field not in data}
                }, status=400)
            
            # Cria o novo equipamento
            equipamento = Equipamento(
                nome=data['nome'],
                codigo=data['codigo'],
                vida_util_dias=data['vida_util_dias'],
                ca=data['ca'],
                ativo=data.get('ativo', True)
            )
            
            equipamento.full_clean()
            equipamento.save()
            
            return JsonResponse({
                'success': True,
                'message': 'Equipamento criado com sucesso',
                'equipamento': {
                    'id': equipamento.id,
                    'nome': equipamento.nome,
                    'codigo': equipamento.codigo,
                    'vida_util_dias': equipamento.vida_util_dias,
                    'ca': equipamento.ca,
                    'ativo': equipamento.ativo
                }
            })
            
        except ValidationError as e:
            return JsonResponse({
                'success': False,
                'message': 'Erro de validação',
                'errors': e.message_dict
            }, status=400)
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': str(e),
                'detail': 'Erro interno no servidor'
            }, status=500)

@login_required
@somente_master
@require_http_methods(["PUT", "PATCH"])
def alter_equipamento(request, id):
    try:
        equipamento = Equipamento.objects.filter(id=id).first()
        
        if not equipamento:
            return JsonResponse(
                {'success': False, 'message': 'Equipamento não encontrado'}, 
                status=404
            )

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

                # Atualização dos campos
                equipamento.nome = data.get('nome', equipamento.nome)
                equipamento.codigo = data.get('codigo', equipamento.codigo)
                equipamento.vida_util_dias = int(data.get('vida_util_dias', equipamento.vida_util_dias))
                equipamento.ca = data.get('ca', equipamento.ca)
                
                equipamento.full_clean()  # Valida o modelo antes de salvar
                equipamento.save()
                
                return JsonResponse({
                    'success': True, 
                    'message': 'Equipamento atualizado com sucesso',
                    'data': {
                        'id': equipamento.id,
                        'nome': equipamento.nome,
                        'codigo': equipamento.codigo,
                        'vida_util_dias': equipamento.vida_util_dias,
                        'ca': equipamento.ca,
                        'ativo': equipamento.ativo
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
                equipamento.ativo = not equipamento.ativo
                equipamento.save()
                
                return JsonResponse({
                    'success': True, 
                    'message': f'Equipamento {"ativado" if equipamento.ativo else "desativado"} com sucesso',
                    'novo_status': equipamento.ativo
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