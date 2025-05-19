from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from usuario.decorators import somente_master
from .models import Equipamento
from django.http import JsonResponse

# Create your views here.

@login_required
@somente_master
def equipamento(request):

    if request.method == 'GET':
        all_equipamentos = Equipamento.objects.all().order_by("id")

        equipamentos = list(all_equipamentos.values())

        print(equipamentos)

        return render(request, 'equipamento.html', {'equipamentos':equipamentos})
    
    if request.method == 'POST':

        return JsonResponse({})

@login_required
@somente_master
def alter_equipamento(request, id):

    if request.method == 'PUT':

        return JsonResponse({})

    if request.method == 'DELETE':

        return JsonResponse({})