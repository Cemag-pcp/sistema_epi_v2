from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('home/', views.home, name='home'),
    path('solicitacoes/', views.home_solicitacoes, name='solicitacoes'),
    path('solicitacoes/<int:id>/', views.alter_solicitacao, name='solicitacoes_by_id')
]