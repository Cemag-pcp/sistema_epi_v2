from django.shortcuts import render
from django.http import JsonResponse
from usuario.models import Funcionario

# Create your views here.
def template_ficha(request):

    funcionarios = Funcionario.objects.values('id','matricula','nome').order_by('id')

    return render(request, 'ficha.html', {'funcionarios':funcionarios})

def gerar_ficha_epi(request):

    return JsonResponse({})