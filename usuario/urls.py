from django.urls import path
from . import views


app_name = 'usuario'

urlpatterns = [
    path('login/', views.login_view, name='login_view'),
    path('logout/', views.logout_view, name='logout_view'),
    path('', views.redirecionar, name='redirecionar'),  # Redireciona para a pagina de login
    path('funcionario/', views.funcionario, name='funcionario'),  # Pagina do funcionario (Listar e Cadastrar)
    path('setor/<int:id>/', views.get_funcionarios_pelo_setor, name='get-funcionarios-pelo-setor'), # PUT, PATCH
    path('editar_funcionario/<int:id>/', views.editar_funcionario, name='editar_funcionario'),  # Editar funcionario
    path('api/funcionarios/', views.api_funcionarios, name='api_funcionarios'),  # API para listar funcionarios
    path('api_setores/', views.api_setores, name='api_setores'),  # Api setores
    path('usuario/',views.usuario, name='usuario'),  # Api usuarios
    path('api_setores/<int:id>/', views.busca_setor, name='busca_setor'), # Buscar um setor especifico com o id
    path('setores/',views.setores,name='setores'), # Pagina setores
    path('setores/<int:id>/',views.editar_setor, name='editar_setor'),
    path('cargos/', views.cargos, name='cargos'),  # Pagina/CRUD de cargos
    path('cargos/<int:id>/', views.editar_cargo, name='editar_cargo'),
    path('api_cargos/',views.api_cargos, name='api_cargos'), # Api cargos
    path('api_itens_ativos/<int:id>/',views.itens_ativos_funcionario, name='itens_ativos_funcionario'), # Verificar itens ativos de um funcionario
    path('inventario/', views.inventario, name='inventario'), # Inventario do operador
]
