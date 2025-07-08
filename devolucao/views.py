from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.db import transaction, IntegrityError
from usuario.decorators import somente_master
from .models import Devolucao, DadosSolicitacao
import json
import traceback


@login_required
@somente_master
def devolucao(request):
    if request.method == "GET":
        return render(request, 'devolucao.html')
    elif request.method == "POST":
        #pegar os parametros
        try:
            data = json.loads(request.body)
            print(data)
            
            #validar
            required_fields = ['funcionarioId', 'items']

            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                return JsonResponse({
                    'success': False,
                    'message': 'Campos obrigatórios faltando',
                    'errors': {field: 'Este campo é obrigatório' for field in missing_fields}
                }, status=400)
            
            
            
            # Como a lista de dicionarios items puxa um DadosSolicitacao diferente, 
            # é possível criar uma devolucao exclusiva para cada elemento dessa lista baseado no id que é o id de DadosSolicitacao

            #criar uma devolução
            with transaction.atomic():
                for item in data['items']:
                    dados_solicitacao = DadosSolicitacao.objects.get(pk=item['id'])

                    devolut = Devolucao(
                        dados_solicitacao=dados_solicitacao,
                        responsavel_recebimento=request.user,
                        estado_item=item['condicao'],
                        observacoes=item['observacao'],
                    )
                    #salvar
                    devolut.save()
            
            #retornar sucesso ou erro
            print('Devolução registrada')
            return JsonResponse({"success":True,
                                 "message": "ok"},
                                 status=200)
        
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 
                                 'message': 'JSON inválido'}, 
                                  status=400)
        except KeyError as e:
            return JsonResponse({'success': False, 
                                 'message': f'Campo ausente: {str(e)}'}, 
                                  status=400)
        except IntegrityError as e:
            return JsonResponse({'success': False, 
                                 'message': 'Erro de banco de dados'}, 
                                  status=500)
        except Exception as e:
            traceback.print_exc()
            return JsonResponse({'success': False,
                                 'message': f'Erro inesperado: {str(e)}'},
                                  status=500)
    else:
        return JsonResponse(
            {"success": False, 
             "message": "Método não permitido"},
              status=405  # 405 = Method Not Allowed
        )
