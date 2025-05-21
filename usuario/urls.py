from django.urls import path
from . import views


app_name = 'usuario'

urlpatterns = [
    path('login/', views.login_view, name='login_view'),
    path('logout/', views.logout_view, name='logout_view'),
    path('', views.redirecionar, name='redirecionar'),  # Redireciona para a página de login
    path('funcionario/', views.listar_funcionarios, name='listar_funcionarios'),  # Página do funcionário
    path('cadastrar_funcionario/', views.cadastrar_funcionario, name='cadastrar_funcionario'),  # Cadastrar funcionário
]