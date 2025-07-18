from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.db import transaction, IntegrityError
from django.db.models import Sum, F, Q
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
            # return "ok"
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
                    dados_solicitacao = DadosSolicitacao.objects.annotate(
                        total_devolvido=Sum('dados_solicitacao_devolucao__quantidade_devolvida')
                    ).get(pk=item['id'])

                    # Validando o que já foi devolvido
                    total_ja_devolvido = dados_solicitacao.total_devolvido or 0

                    # Pegando a quantidade disponível para devolução
                    quantidade_disponivel = dados_solicitacao.quantidade - total_ja_devolvido

                    # Validando a quantidade devolvida
                    if int(item['qtdDevolvida']) <= 0:
                        raise ValueError("Quantidade devolvida deve ser maior que zero!")
                    # Quantidade devolvida não pode ser maior que a quantidade disponível
                    if int(item['qtdDevolvida']) > quantidade_disponivel:
                        raise ValueError(f"Quantidade devolvida ({item['qtdDevolvida']}) maior que a disponível ({quantidade_disponivel})!")
                    # dados_solicitacao = DadosSolicitacao.objects.get(pk=item['id'])

                    devolut = Devolucao(
                        dados_solicitacao=dados_solicitacao,
                        responsavel_recebimento=request.user,
                        estado_item=item['condicao'],
                        observacoes=item['observacao'],
                        quantidade_devolvida=item['qtdDevolvida'],
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
