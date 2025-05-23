from django.urls import path
from . import views

app_name = 'solicitacao'

urlpatterns = [
    path('', view=views.solicitacao, name='solicitacao')
]