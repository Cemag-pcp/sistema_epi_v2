from django.urls import path
from . import views

urlpatterns = [
    path('nova/', views.add_solicitacao, name='add_solicitacao'),
    # path('lista/', views.SolicitacaoListView.as_view(), name='solicitacao_list'),
]