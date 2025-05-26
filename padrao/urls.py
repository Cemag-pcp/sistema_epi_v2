from django.urls import path
from . import views

app_name = 'padrao'

urlpatterns = [
    path('', views.padroes, name='padrao'),
]