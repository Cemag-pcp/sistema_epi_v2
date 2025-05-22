from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.shortcuts import render, redirect
from django.http import JsonResponse
from usuario.models import Funcionario
from django.contrib.auth.decorators import login_required
from usuario.decorators import somente_master
import json

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
            print(request.POST.get('next'))
            next_url = request.POST.get('next') or 'core:home'  # 'home' pode ser o nome da URL
            return redirect(next_url)
            # return redirect('core:home')
            
        else:
            # Aqui você pode adicionar uma mensagem de erro se o login falhar
            messages.error(request, "Usuário ou senha inválidos.", extra_tags='danger')
    if request.user.is_authenticated:
        return redirect('core:home')
    return render(request, 'usuario/login.html')

@login_required
def logout_view(request):
    logout(request)
    return redirect('usuario:login_view')

def redirecionar(request):
    return redirect('usuario:login_view')

@login_required
@somente_master
def listar_funcionarios(request):
    return render(request, 'usuario/funcionario.html')

@login_required
@somente_master
def api_funcionarios(request):
    if request.method == 'GET':
        # Aqui você pode adicionar a lógica para listar os funcionários

        funcionarios = Funcionario.objects.select_related('setor').all().order_by('id')

        list_funcionarios = [
            {
                'id': f.id,
                'nome': f.nome,
                'matricula': f.matricula,
                'setor': f.setor.nome,
                'cargo':f.cargo,
                'responsavel': 'teste_responsavel',
                'dataAdmissao': f.data_admissao,
                'status': 'Ativo' if f.ativo else 'Desativado'
            }
            for f in funcionarios
        ]
        print(list_funcionarios)
        # employees = [
        # {
        #     'id': 1,
        #     'matricula': "F001",
        #     'nome': "João Silva Morais",
        #     'cargo': "Desenvolvedor Sênior",
        #     'setor': "Engenharia",
        #     'responsavel': "Carlos Mendes",
        #     'dataAdmissao': "2020-05-12",
        #     'status': "Ativo"
        # },
        # {
        #     'id': 2,
        #     'matricula': "F002",
        #     'nome': "Maria Oliveira",
        #     'cargo': "Gerente de Produto",
        #     'setor': "Produto",
        #     'responsavel': "Ana Souza",
        #     'dataAdmissao': "2019-11-18",
        #     'status': "Ativo"
        # },
        # {
        #     'id': 3,
        #     'matricula': "F003",
        #     'nome': "Pedro Santos",
        #     'cargo': "Designer UX",
        #     'setor': "Design",
        #     'responsavel': "Fernanda Lima",
        #     'dataAdmissao': "2021-02-03",
        #     'status': "Desativado"
        # },
        # {
        #     'id': 4,
        #     'matricula': "F004",
        #     'nome': "Ana Costa",
        #     'cargo': "Especialista de Marketing",
        #     'setor': "Marketing",
        #     'responsavel': "Roberto Alves",
        #     'dataAdmissao': "2018-07-22",
        #     'status': "Desativado"
        # },
        # {
        #     'id': 5,
        #     'matricula': "F005",
        #     'nome': "Roberto Almeida",
        #     'cargo': "Gerente de RH",
        #     'setor': "Recursos Humanos",
        #     'responsavel': "Carla Ferreira",
        #     'dataAdmissao': "2017-09-15",
        #     'status': "Ativo"
        # }
        # ]
        return JsonResponse(list_funcionarios, safe=False)
    return JsonResponse({'status': 'error', 'message': 'Método não permitido!'}, status=405)

@login_required
@somente_master
def cadastrar_funcionario(request):
    if request.method == 'POST':
        # Aqui você pode adicionar a lógica para cadastrar o funcionário
        print(json.loads(request.body))
        pass
    return JsonResponse({'status': 'success', 'message': 'Funcionário cadastrado com sucesso!'})

@login_required
@somente_master
def editar_funcionario(request, id):
    if request.method == 'PUT':
        # Aqui você pode adicionar a lógica para editar o funcionário
        print(id)
        print(json.loads(request.body))
        pass
    elif request.method == 'PATCH':
        print(id)
        print(json.loads(request.body))
        pass
    return JsonResponse({'status': 'success', 'message': 'Funcionário editado com sucesso!'})
