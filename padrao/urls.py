from django.urls import path
from . import views

app_name = 'padrao'

urlpatterns = [
    path('', views.padroes_view, name='padrao'),
    path('api/', views.padroes, name='padroes-api'),
    path('<int:id>/', views.alter_padrao, name='alter-equipamento'), # PUT, PATCH
    path('equipamentos/', views.equipaments_padrao, name='equipamento-padrao'), # PUT, PATCH
    path('funcionarios/<int:id>', views.funcionarios_padrao, name='funcionario-padrao'), # PUT, PATCH
]