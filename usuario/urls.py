from django.urls import path
from . import views


app_name = 'usuario'

urlpatterns = [
    path('login/', views.login_view, name='login_view'),
    path('logout/', views.logout_view, name='logout_view'),
    path('', views.redirecionar, name='redirecionar'),  # Redireciona para a página de login
    path('funcionario/', views.funcionario, name='funcionario'),  # Página do funcionário (Listar e Cadastrar)
    path('editar_funcionario/<int:id>/', views.editar_funcionario, name='editar_funcionario'),  # Editar funcionário
    path('api/funcionarios/', views.api_funcionarios, name='api_funcionarios'),  # API para listar funcionários
    path('api_setores/', views.api_setores, name='api_setores'),  # Api setores
    path('usuario/',views.usuario, name='usuario'),  # Api usuarios
    path('api_setores/<int:id>/', views.busca_setor, name='busca_setor'), # Buscar um setor específico com o id
    path('setores/',views.setores,name='setores'),# Página setores
    path('setores/<int:id>/',views.editar_setor, name='editar_setor'),
    path('api_cargos/',views.api_cargos, name='api_cargos'), #api setores
    
]