from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.contrib.auth.password_validation import validate_password
from django.views.decorators.http import require_http_methods

from django.core.exceptions import ValidationError
from django.db.models import Sum, F, Q
from django.db import transaction, DatabaseError
from django.core.exceptions import ObjectDoesNotExist

from usuario.models import Funcionario,Setor,Usuario,Cargo
from solicitacao.models import DadosSolicitacao
from usuario.decorators import somente_master, master_solicit

import traceback
import json
import numpy as np

def login_view(request):
    if request.method == 'POST':
        # matricula
        matricula = request.POST.get('matricula')
        password = request.POST.get('password')

        user = authenticate(request, username=matricula, password=password)
        if user:
            login(request, user)
            if (user.is_superuser) or (user.is_authenticated and user.funcionario.tipo_acesso == 'master'):
                print('Redirecionando para a página de administração')
                next_url = request.POST.get('next') or 'core:home'
                # Redirecionar para a página inicial de solicitações
            elif user.funcionario.tipo_acesso == 'solicitante':
                print('Redirecionando para a página de funcionário')
                next_url = request.POST.get('next') or 'solicitacao:solicitacao'
                # Enquanto ainda não existe uma página de solicitação EPI, vamos redirecionar para a home
            else:
                print('Redirecionando para a página padrão')
                next_url = request.POST.get('next') or 'usuario:inventario'
                #Enquanto ainda não existe uma página de (inventário??) vamos redirecionar para a home
            print(request.POST.get('next'))
            return redirect(next_url)
            
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
def api_funcionarios(request):
    if request.method == 'GET':
        funcionario_id = request.GET.get('func_id',None)
        
        # Converter para float de forma segura
        try:
            func_id = int(funcionario_id)
        except (TypeError, ValueError):
            func_id = None  # Se não for um número válido
        
        # Aqui você pode adicionar a lógica para listar os funcionários
        if func_id is None and not request.user.is_superuser and not request.user.funcionario.tipo_acesso == 'master':
                return JsonResponse({'error': 'Acesso negado'}, status=403)
        if func_id:
            try:
                funcionario = Funcionario.objects.get(id=func_id)
                return JsonResponse([{
                    'id': funcionario.id,
                    'nome': funcionario.nome,
                    'matricula': funcionario.matricula,
                    'setor': funcionario.setor.nome if funcionario.setor else '',
                    'cargo': funcionario.cargo.nome if funcionario.cargo else '',
                    'data_admissao': funcionario.data_admissao,
                    'ativo': funcionario.ativo,
                    'usuario': funcionario.usuario.id if funcionario.usuario else '',
                    'tipo_acesso': funcionario.tipo_acesso,
                }], safe=False,status=200)
            except Funcionario.DoesNotExist:
                return JsonResponse({'error': 'Funcionário não encontrado'}, status=404)
        # Se não houver id, retorna todos os funcionários
        funcionarios = Funcionario.objects.select_related('setor','setor__responsavel','cargo').values(
            'id', 'nome', 'matricula', 'setor__nome', 'setor__id',
                'setor__responsavel__nome', 'setor__responsavel__matricula','cargo_id',
                'cargo__nome', 'data_admissao', 'ativo','usuario','tipo_acesso',
        ).order_by('id')
        


        list_funcionarios = [
           {
                'id': f['id'],
                'nome': f['nome'],
                'matricula': f['matricula'],
                'setor': f['setor__nome'] if f['setor__nome'] else '',
                'cargo': f['cargo__nome'] if f['cargo__nome'] else '',
                'responsavel': f"{f['setor__responsavel__matricula']} - {f['setor__responsavel__nome']}" if f['setor__responsavel__matricula'] else '--',
                'dataAdmissao': f['data_admissao'],
                'status': 'Ativo' if f['ativo'] else 'Desativado',
                'setorId': f['setor__id'] if f['setor__id'] else '',
                'usuario': f['usuario'] if f['usuario'] else '', 
                'hasUsuario': bool(f['usuario']),
                'tipoAcesso': f['tipo_acesso'],
                'cargoId': f['cargo_id'] if f['cargo_id'] else '',
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
            required_fields = ['nome', 'matricula', 'setor', 'cargo','tipoAcesso']
            if not all(field in data for field in required_fields):
                return JsonResponse({
                    'success': False,
                    'message': 'Campos obrigatórios faltando',
                    'errors': {field: 'Este campo é obrigatório' for field in required_fields if field not in data}
                }, status=400)
            
            novo_cargo = Cargo.objects.filter(id=int(data['cargoId'])).first()
            #Criar o funcionário
            funcionario = Funcionario(
                nome=data['nome'],
                matricula=data['matricula'],
                setor_id=int(data['setorId']),
                cargo=novo_cargo,
                data_admissao=data['dataAdmissao'],
                tipo_acesso=data['tipoAcesso'],
                ativo=True,
            )
            funcionario.full_clean()  # Valida os dados do funcionário
            funcionario.save()

            return JsonResponse({
                'success': True,
                'message': 'Funcionário cadastrado com sucesso!',
                'funcionario': {
                    'id': funcionario.id,
                    'nome': funcionario.nome,
                    'matricula': int(funcionario.matricula),
                    'setor': funcionario.setor.nome,
                    'cargo': funcionario.cargo.nome,
                    'usuario': False, 
                    'hasUsuario': False,
                    'data_admissao': funcionario.data_admissao,
                    'tipo_acesso': funcionario.tipo_acesso,
                    'status': 'Ativo' if funcionario.ativo else 'Desativado',
                }
            }, status=201)
        
        except ValidationError as e:
            return JsonResponse({
                'success': False,
                'message': 'Erro de validação',
                'errors': e.message_dict
            }, status=400)
        
        except Exception as e:
            print('Stack trace:',traceback.format_exc())  # Captura a stack trace completa como string
            return JsonResponse({
                'success': False,
                'message': 'Erro ao cadastrar funcionário',
                'errors': str(e)
            }, status=500)

    return JsonResponse({'status': 'success', 'message': 'Funcionário cadastrado com sucesso!'})

@login_required
@master_solicit
@require_http_methods(["GET"])
def get_funcionarios_pelo_setor(request, id):

    if request.method == 'GET':

        funcionarios = list(Funcionario.objects.filter(setor__id=id).values('id','nome','matricula'))

        return JsonResponse({'funcionarios':funcionarios}, status=200)

@login_required
@somente_master
def editar_funcionario(request, id):
    try:
        funcionario = Funcionario.objects.filter(id=id).first()
        
        if not funcionario:
            return JsonResponse(
                {'success': False, 'message': 'Funcionário não encontrado'}, 
                status=404
            )

        if request.method == 'PUT':
            try:
                data = json.loads(request.body) if request.body else {}
                print(data)
                # Validação do json
                required_fields = ['setor', 'cargo','tipoAcesso']
                if not all(field in data for field in required_fields):
                    return JsonResponse({
                        'success': False,
                        'message': 'Campos obrigatórios faltando',
                        'errors': {field: 'Este campo é obrigatório' for field in required_fields if field not in data}
                    }, status=400)
                
                
                # Atualização dos campos
                # Fazer algo depois para retornar não-modificado caso não mude nada nos atributos
                
                # funcionario.nome = data.get('nome', funcionario.nome)
                # funcionario.matricula = data.get('matricula', funcionario.matricula)

                # verifica o setor antigo para verificar se o responsável do setor antigo é o funcionário
                with transaction.atomic():
                    setor_antigo = funcionario.setor  

                    # Se o funcionario for responsável de um setor, trocará o responsável do setor antigo para None
                    if funcionario.setor.responsavel and funcionario.setor.responsavel.id == funcionario.id:
                        setor_antigo.responsavel = None
                        setor_antigo.save()
                    
                    funcionario.setor_id = int(data.get('setorId', funcionario.setor_id))
                    novo_cargo = Cargo.objects.filter(id=int(data.get('cargoId', funcionario.cargo))).first()
                    funcionario.cargo = novo_cargo
                    # funcionario.data_admissao = data.get('dataAdmissao', funcionario.data_admissao)
                    funcionario.tipo_acesso = data.get('tipoAcesso', funcionario.tipo_acesso)
                    
                    
                    funcionario.full_clean()  # Valida o modelo antes de salvar
                    funcionario.save()
                
                return JsonResponse({
                    'success': True,
                    'message': 'Funcionário atualizado com sucesso!',
                    'funcionario': {
                        'id': funcionario.id,
                        'nome': funcionario.nome,
                        'matricula': funcionario.matricula,
                        'setor': funcionario.setor.nome,
                        'cargo': funcionario.cargo.nome,
                        'data_admissao': funcionario.data_admissao,
                        'tipo_acesso': funcionario.tipo_acesso,
                        'status': 'Ativo' if funcionario.ativo else 'Desativado',
                        }
                    }, status=201)

            except json.JSONDecodeError as e:
                print(e)
                return JsonResponse(
                    {'success': False, 'message': 'Formato JSON inválido'},
                    status=400
                )
            except ValidationError as e:
                print(e)
                return JsonResponse({
                    'success': False,
                    'message': 'Erro de validação',
                    'errors': e.message_dict
                }, status=400)

            except ValueError as e:
                print(e)
                return JsonResponse(
                    {'success': False, 'message': str(e)},
                    status=400
                )

            except Exception as e:  
                print('Stack trace:', traceback.format_exc()) # Captura a stack trace completa como string
                return JsonResponse({
                    'success': False,
                    'message': 'Erro ao atualizar funcionário',
                    'errors': str(e)
                }, status=500)

        elif request.method == 'PATCH':
            try:
                funcionario.ativo = not funcionario.ativo
                funcionario.save()
                
                return JsonResponse({
                    'success': True, 
                    'message': f'Funcionário {"ativado" if funcionario.ativo else "desativado"} com sucesso',
                    'novo_status': funcionario.ativo
                }, status=201)
                
            except Exception as e:
                return JsonResponse(
                    {'success': False, 'message': f'Erro ao alterar status: {str(e)}'},
                    status=500
                )

    except Exception as e:
        return JsonResponse(
            {'success': False, 'message': f'Erro interno no servidor: {str(e)}'},
            status=500
        )

@login_required
@master_solicit
def api_setores(request):
    if request.method == 'GET':
        setor_id = request.GET.get('setor_id')
        
        query = Setor.objects.select_related('responsavel')
        
        if setor_id:
            query = query.filter(id=setor_id)
        
        setores = query.values(
            'id',
            'nome',
            'responsavel_id',
            'responsavel__nome',
            'responsavel__matricula'
        )

        setores_list = [
            {
                **s,
                'responsavel_id': s['responsavel_id'] if s['responsavel_id'] else '',
                'responsavel__nome': s['responsavel__nome'] if s['responsavel_id'] else '--',
                'responsavel__matricula': s['responsavel__matricula'] if s['responsavel_id'] else '',
            }
            for s in setores
        ]
        
        return JsonResponse(setores_list, safe=False)
    return JsonResponse({'status': 'success', 'message': 'Setores listados com sucesso!'})

@login_required
@somente_master
@require_http_methods(["GET","POST"])
def usuario(request):
    if request.method == 'GET':
        tipo_acesso = request.GET.get('tipoAcesso')

        # Filtra diretamente os funcionários
        funcionarios = Funcionario.objects.filter(ativo=True)
        
        if tipo_acesso in ["solicitante", "operador"]:
            funcionarios = funcionarios.filter(tipo_acesso=tipo_acesso)

        # Converte para o formato desejado (similar ao anterior)
        dados = list(funcionarios.values(
            'id',
            'nome',
            'matricula',
            'tipo_acesso'
        ))

        # Adiciona campos vazios para manter compatibilidade com o formato anterior
        for item in dados:
            item['funcionario__id'] = item['id']
            item['funcionario__nome'] = item['nome']
            item['funcionario__matricula'] = item['matricula']
            item['funcionario__tipo_acesso'] = item['tipo_acesso']
            item['id'] = None  # ID do usuário (não existe mais)
            item['nome'] = None  # Nome do usuário (não existe mais)

        return JsonResponse(dados, safe=False)
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            # print(data)


            # Validação do json
            required_fields = ['nome', 'matricula', 'funcionarioId']
            if not all(field in data for field in required_fields):
                return JsonResponse({
                    'success': False,
                    'message': 'Campos obrigatórios faltando',
                    'errors': {field: 'Este campo é obrigatório' for field in required_fields if field not in data}
                }, status=400)

            # Criar o usuário
            with transaction.atomic():
                usuario = Usuario(
                    nome=data['nome'],
                    matricula=data['matricula'],
                    funcionario_id=int(data['funcionarioId']),
                    is_staff=True,  # Definindo como True para permitir acesso ao admin
                    is_superuser=False  # Definindo como False por padrão
                )
                validate_password(data['senha'], user=usuario)
                usuario.set_password(data['senha'])
                usuario.full_clean()  # Valida os dados do usuário
                usuario.save()

                funcionario = get_object_or_404(Funcionario,pk=data['funcionarioId'])
                funcionario.tipo_acesso = data['tipoAcesso']
                funcionario.save()

            return JsonResponse({
                'success': True,
                'message': 'Usuário cadastrado com sucesso!',
                'usuario': {
                    'id': usuario.id,
                    'nome': usuario.nome,
                    'matricula': usuario.matricula,
                    'tipo_acesso': funcionario.tipo_acesso,
                    'funcionario_id': usuario.funcionario_id,
                }
            }, status=201)

        except ValidationError as e:
            print('Stack trace:', traceback.format_exc())
            return JsonResponse({
                'success': False,
                'message': 'Erro de validação',
                'errors': {'validação': e.messages}
            }, status=400)

        except Exception as e:
            print('Stack trace:', traceback.format_exc())
            return JsonResponse({
                'success': False,
                'message': 'Erro ao cadastrar usuário',
                'errors': str(e)
            }, status=500)
        

@login_required
@somente_master
def busca_setor(request,id):
    if request.method == 'GET':
        try:
            setor = get_object_or_404(Setor,pk=id)

            responsavel_setor = {
                'matricula': setor.responsavel.matricula if setor.responsavel else None,
                'nome': setor.responsavel.nome if setor.responsavel else None,
            }

            return JsonResponse(responsavel_setor)
        
        except Exception as e:
            print('Stack trace:', traceback.format_exc())
            return JsonResponse({
                'success': False,
                'message': 'Erro ao buscar Setores',
                'errors': str(e)
            }, status=500)
        
@login_required
@somente_master
def setores(request):
    if request.method == 'GET':
        return render(request,'usuario/setores.html')
    
@login_required
@somente_master
def editar_setor(request,id):
    #Editar o responsável do setor
    try:
        setor = Setor.objects.filter(id=id).first()
        
        if not setor:
            return JsonResponse(
                {'success': False, 'message': 'Setor não encontrado'}, 
                status=404
            )

        if request.method == 'PATCH':
            try:

                data = json.loads(request.body) if request.body else {}
                print(data)
                forcar = data['forcar'] == True
                # print(forcar)
                setor_antigo = None
                if forcar:
                    print('entrou no forcar')
                    with transaction.atomic():
                        novo_responsavel = Funcionario.objects.filter(id=data['responsavel']).first()
                        setor_antigo = Setor.objects.filter(id=novo_responsavel.setor.id).first()
                        setor_antigo.responsavel=None
                        setor_antigo.save()

                        novo_responsavel.setor = setor
                        novo_responsavel.save()

                        setor.responsavel = novo_responsavel
                        setor.save()
                else:
                    for s in data.get('setores',[]):
                        print(data['responsavel'] == s['responsavel_id'])
                        if data['responsavel'] == s['responsavel_id'] and setor.id != s['id']:
                            return JsonResponse(
                            {'success': False, 'message': f'Solicitante escolhido já é responsável de outro setor!'},
                            status=500
                        )

                    with transaction.atomic():
                        novo_responsavel = Funcionario.objects.filter(id=data['responsavel']).first()
                        setor.responsavel = novo_responsavel

                        novo_responsavel.setor = setor
                        novo_responsavel.save()

                        setor.save()
                
                return JsonResponse({
                    'success': True, 
                    'message': f'Responsavel alterado com sucesso!',
                    'responsavel': {'id':setor.responsavel.id, 
                                    'nome': setor.responsavel.nome, 
                                    'matricula': setor.responsavel.matricula, 
                                    'setorVazio': setor_antigo.id if setor_antigo else ''
                                    }
                }, status=201)
                
            except Exception as e:
                print('Stack trace:', traceback.format_exc())
                print(e)
                return JsonResponse(
                    {'success': False, 'message': f'Erro ao alterar responsável: {str(e)}'},
                    status=500
                )

    except Exception as e:
        print(e)
        return JsonResponse(
            {'success': False, 'message': f'Erro interno no servidor: {str(e)}'},
            status=500
        )
    
@login_required
@somente_master
def api_cargos(request):
    if request.method == 'GET':
        cargos = list(Cargo.objects.values())

        return JsonResponse(cargos, safe=False)
    
@login_required
def itens_ativos_funcionario(request,id):
    if request.method == 'GET':
        try:
            if not request.user.is_superuser: 
                if request.user.funcionario.id != id and not request.user.funcionario.tipo_acesso == 'master':
                    return JsonResponse({'error': 'Acesso negado'}, status=403)
            # itens_ativos = DadosSolicitacao.objects.filter(solicitacao__status='Entregue',solicitacao__funcionario=id,dados_solicitacao_devolucao=None).order_by("-solicitacao__data_atualizacao")

            itens_ativos = ( DadosSolicitacao.objects
            .select_related('solicitacao','equipamento')
            .prefetch_related('dados_solicitacao_devolucao')
            .annotate(
                total_devolvido=Sum('dados_solicitacao_devolucao__quantidade_devolvida')
            ).filter(
                solicitacao__status='Entregue',
                solicitacao__funcionario=id
            ).filter(
                Q(total_devolvido__isnull=True) | Q(total_devolvido__lt=F('quantidade'))
            ).order_by('-solicitacao__data_atualizacao')
            )

            # print(itens_ativos)

            lista_itens_ativos = []
            for item in itens_ativos:
                lista_itens_ativos.append({
                    'id': item.id,
                    'solicitacao_id': item.solicitacao.id,
                    'equipamento_id': item.equipamento.id,
                    'equipamento_nome': item.equipamento.nome,
                    'equipamento_codigo': item.equipamento.codigo,
                    'quantidade': item.quantidade,
                    'data_recebimento': item.solicitacao.data_atualizacao.date().strftime('%d/%m/%Y'),
                    'quantidade_devolvida_original': item.total_devolvido or 0,
                    'quantidade_disponivel': item.quantidade - (item.total_devolvido or 0),
                })
            #puxar todos os itens entregues que o funcionario possui
            if lista_itens_ativos:
                return JsonResponse(lista_itens_ativos, safe=False)
            else:
                return JsonResponse(lista_itens_ativos,status=404,safe=False)
        except (AttributeError, ObjectDoesNotExist) as e:
            traceback.print_exc()
            return JsonResponse({'error': 'Erro ao acessar dados relacionados: ' + str(e)}, status=500)

        except DatabaseError as e:
            traceback.print_exc()
            return JsonResponse({'error': 'Erro no banco de dados: ' + str(e)}, status=500)

        except Exception as e:
            traceback.print_exc()
            return JsonResponse({'error': 'Erro inesperado: ' + str(e)}, status=500)
    
@login_required
def inventario(request):
    if request.method == 'GET':
        return render(request, 'usuario/inventario.html', {"funcionario":request.user.funcionario})