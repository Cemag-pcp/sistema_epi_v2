from django.urls import path
from . import views

app_name = 'padrao'

urlpatterns = [
    path('', views.padroes, name='padrao'),
    path('<int:id>/', views.alter_padrao, name='alter-equipamento'), # PUT, PATCH
]