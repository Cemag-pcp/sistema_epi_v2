from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.shortcuts import render, redirect
from django.http import JsonResponse
from usuario.models import Funcionario,Setor
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from usuario.decorators import somente_master
from django.core.exceptions import ValidationError
from datetime import datetime
import traceback
import json

def login_view(request):
    if request.method == 'POST':
        # matricula
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

def logout_view(request):
    logout(request)
    return redirect('usuario:login_view')

def redirecionar(request):
    return redirect('usuario:login_view')

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

        return JsonResponse(list_funcionarios, safe=False)
    return JsonResponse({'status': 'error', 'message': 'Método não permitido!'}, status=405)

@login_required
@somente_master
@require_http_methods(["GET", "POST"])
def funcionario(request):
    if request.method == 'GET':
        return render(request, 'usuario/funcionario.html')
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            print(data)

            # Validação do json
            required_fields = ['nome', 'matricula', 'setor', 'cargo']
            if not all(field in data for field in required_fields):
                return JsonResponse({
                    'success': False,
                    'message': 'Campos obrigatórios faltando',
                    'errors': {field: 'Este campo é obrigatório' for field in required_fields if field not in data}
                }, status=400)
            
            #Criar o funcionário
            funcionario = Funcionario(
                nome=data['nome'],
                matricula=data['matricula'],
                setor_id=data['setor'],
                cargo=data['cargo'],
                data_admissao=data['dataAdmissao'],
                ativo=True
            )
            funcionario.full_clean()  # Valida os dados do funcionário
            funcionario.save()

            return JsonResponse({
                'success': True,
                'message': 'Funcionário cadastrado com sucesso!',
                'funcionario': {
                    'id': funcionario.id,
                    'nome': funcionario.nome,
                    'matricula': funcionario.matricula,
                    'setor': funcionario.setor.nome,
                    'cargo': funcionario.cargo,
                    'data_admissao': funcionario.data_admissao,
                    'status': 'Ativo' if funcionario.ativo else 'Desativado'
                }
            }, status=201)
        
        except ValidationError as e:
            print('Validation error:', e.message_dict)
            return JsonResponse({
                'success': False,
                'message': 'Erro de validação',
                'errors': e.message_dict
            }, status=400)
        
        except Exception as e:
            traceback_str = traceback.format_exc()  # Captura a stack trace completa como string
            print('Stack trace:', traceback_str)
            return JsonResponse({
                'success': False,
                'message': 'Erro ao cadastrar funcionário',
                'errors': str(e)
            }, status=500)
        # pass

    return JsonResponse({'status': 'success', 'message': 'Funcionário cadastrado com sucesso!'})

@login_required
@somente_master
def editar_funcionario(request, id):
    if request.method == 'PUT':
        # Aqui você pode adicionar a lógica para editar o funcionário
        print(json.loads(request.body))
        pass
    elif request.method == 'PATCH':
        print(json.loads(request.body))
        pass
    return JsonResponse({'status': 'success', 'message': 'Funcionário editado com sucesso!'})

@login_required
@somente_master
def setores(request):
    if request.method == 'GET':
        setores = Setor.objects.all()
        lista_setores = list(setores.values())
        return JsonResponse(lista_setores, safe=False)
    return JsonResponse({'status': 'success', 'message': 'Setores listados com sucesso!'})
