from django.shortcuts import render
from django.db import transaction
from django.db.utils import IntegrityError
from .models import Solicitacao
from padrao.models import Padrao
from equipamento.models import Equipamento, DadosSolicitacao
from usuario.models import Funcionario
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from usuario.decorators import somente_master, master_solicit
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
                print(padrao)

                if padrao:
                    desc = f"Solicitação com {len(data['itens'])} itens. Utilizando o padrão de id {padrao}"
                else:
                    desc = f"Solicitação com {len(data['itens'])} itens"

                solicitacao = Solicitacao.objects.create(
                    solicitante=usuario,
                    responsavel_entrega=None,  # Será definido no momento da assinatura
                    status='Pendente',
                    observacoes=desc,
                )

                # Processa cada item do JSON
                for item in data.get('itens', []):  # Assumindo que os itens estão em 'itens'
                    equipamento = Equipamento.objects.get(id=item['equipamento_id'])
                    funcionario = Funcionario.objects.get(id=item['funcionario_id'])

                    # Cria o relacionamento DadosSolicitacao
                    DadosSolicitacao.objects.create(
                        solicitacao=solicitacao,
                        equipamento=equipamento,
                        funcionario=funcionario,
                        quantidade=item['quantidades'],
                        observacoes=item['observacoes'],
                        motivo=item['motivos']
                    )

                return JsonResponse({
                    'success': True,
                    'message': 'Solicitação criada com sucesso!'
                }, status=201)
            
        except IntegrityError:
            return JsonResponse({
                'success': False,
                'error': "Não é permitido repetir o mesmo funcionário e equipamento em uma mesma solicitação"
            })

        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e),
            }, status=400)

    return JsonResponse({'error': 'Método não permitido'}, status=405)

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