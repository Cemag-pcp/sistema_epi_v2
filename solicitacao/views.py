from django.shortcuts import render
from padrao.models import Padrao
from django.http import JsonResponse


def solicitacao(request):
    query_value = request.GET.get('query', '')
    
    # Todos os padrões (ou filtrados se necessário)
    padroes = Padrao.objects.all().values('id', 'nome')
    
    return render(request, 'solicitacao.html', {
        'padroes': padroes,
        'query_value': query_value  # Passamos o valor da query para o template
    })

def get_padroes(request):

    return JsonResponse({'success':True})