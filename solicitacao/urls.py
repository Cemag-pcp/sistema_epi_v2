from django.urls import path
from . import views

app_name = 'solicitacao'

urlpatterns = [
    path('', views.solicitacao, name='solicitacao')
]