from django.urls import path
from . import views

app_name = 'solicitacao'

urlpatterns = [
    path('', views.solicitacao, name='solicitacao'),
    path('padroes/', views.get_padroes, name='solcitacao_padroes'),
]