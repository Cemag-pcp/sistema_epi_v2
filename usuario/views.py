from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect

def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            return redirect('home')  # redirecione para alguma página interna
    else:
        form = AuthenticationForm()
    return render(request, 'usuario/login.html', {'form': form})

def logout_view(request):
    logout(request)
    return redirect('login_view')

@login_required
def home(request):
    return render(request, 'usuario/home.html')
