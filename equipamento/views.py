from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from usuario.decorators import somente_master

@login_required
@somente_master
def equipamento(request):
    return render(request, 'equipamento.html')