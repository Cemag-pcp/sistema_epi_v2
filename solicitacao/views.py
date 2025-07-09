from django.shortcuts import render
from django.db import transaction
from django.db.utils import IntegrityError
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

                # Criando uma solicitação para cada funcionário
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
    # Recebe uma lista de pares funcionario_id/equipamento_id
    pares = json.loads(request.GET.get('pares', '[]'))

    print(pares)
    
    if not pares:
        return JsonResponse({'error': 'Parâmetros faltando'}, status=400)
    
    # Prepara a consulta para verificar todos os pares de uma vez
    conditions = Q()
    for par in pares:
        conditions |= (
            Q(solicitacao__funcionario_id=par['funcionario_id']) &
            Q(equipamento_id=par['equipamento_id']) &
            Q(solicitacao__status='Entregue')
        )
    
    # Busca todos os registros que correspondem a qualquer um dos pares
    existentes = DadosSolicitacao.objects.filter(conditions).values_list(
        'solicitacao__funcionario_id', 'equipamento_id'
    )
    
    print(existentes)

    # Converte para um conjunto de tuplas para busca rápida
    existentes_set = {(f, e) for f, e in existentes}
    
    # Prepara o resultado
    resultado = {
        f"{par['funcionario_id']}_{par['equipamento_id']}": (int(par['funcionario_id']), int(par['equipamento_id'])) in existentes_set
        for par in pares
    }

    return JsonResponse(resultado)