from django.urls import path
from . import views

app_name = 'solicitacao'

urlpatterns = [
    path('', views.solicitacao_template, name='solicitacao'),
    path('api/', views.solicitacao, name='solicitacao_api'),
    path('verificar-equipamentos/', views.verificar_equipamentos, name='verificar_equipamentos'),
]