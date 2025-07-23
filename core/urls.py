from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('home/', views.home, name='home'),
    path('solicitacoes/', views.home_solicitacoes, name='solicitacoes'),
    path('solicitacoes/<int:id>/', views.alter_solicitacao, name='solicitacoes_by_id'),
    path('assinatura/', views.send_signature, name='assinatura'),
    path('assinatura/<int:id>/', views.alter_signature, name='assinatura_by_id'),
    path('historico/', views.historico, name='historico'),
    path('api_historico/', views.api_historico, name='api_historico'),
    path('dashboard/', views.dashboard_template, name='dashboard'),
    path('dashboard/cards/', views.dashboard, name='dashboard_cards'),
]