from django.urls import path
from . import views

app_name = 'devolucao'

urlpatterns = [
    path('', views.devolucao, name='devolucao'),
]