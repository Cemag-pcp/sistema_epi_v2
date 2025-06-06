from django.shortcuts import render
from padrao.models import Padrao, PadraoEquipamento
from equipamento.models import Equipamento
from usuario.models import Funcionario
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from usuario.decorators import somente_master, master_solicit

@login_required
@master_solicit
def solicitacao_template(request):
    query_value = request.GET.get('query', '')
    
    if request.user.is_superuser == True:
        padroes = Padrao.objects.filter(ativo=True).values('id', 'nome')
    else:
        padroes = Padrao.objects.filter(setor=request.user.funcionario.setor, 
                                        ativo=True).values('id', 'nome')
        
    motivos = [{'id': reason[0], 'nome': reason[1]} for reason in PadraoEquipamento.REASON_CHOICES]
    
    return render(request, 'solicitacao.html', {
        'padroes': padroes,
        'query_value': query_value,  # Passamos o valor da query para o template
        'motivos': motivos
    })

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