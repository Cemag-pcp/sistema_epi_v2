from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from usuario.decorators import somente_master

# Create your views here.

@login_required
# @somente_master
def home(request):
    return render(request, 'home.html')