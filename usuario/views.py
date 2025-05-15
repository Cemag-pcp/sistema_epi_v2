from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.shortcuts import render, redirect

def login_view(request):
    if request.method == 'POST':
        matricula = request.POST.get('matricula')
        password = request.POST.get('password')

        user = authenticate(request, username=matricula, password=password)
        if user:
            login(request, user)
            if user.tipo_acesso == 'master':
                print('Redirecionando para a página de administração')
                # Redirecionar para a página inicial de solicitações
            elif user.tipo_acesso == 'solicitante':
                print('Redirecionando para a página de funcionário')
                # Enquanto ainda não existe uma página de solicitação EPI, vamos redirecionar para a home
            else:
                print('Redirecionando para a página padrão')
                #Enquanto ainda não existe uma página de (inventário??) vamos redirecionar para a home
            return redirect('core:home')
            
        else:
            # Aqui você pode adicionar uma mensagem de erro se o login falhar
            messages.error(request, "Usuário ou senha inválidos.")

    return render(request, 'usuario/login.html')

def logout_view(request):
    logout(request)
    return redirect('usuario:login_view')

def redirecionar(request):
    return redirect('usuario:login_view')

