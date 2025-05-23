from django.urls import path
from . import views

app_name = 'equipamento'

urlpatterns = [
    path('', views.equipamento, name='equipamento'),
    path('<int:id>/', views.alter_equipamento, name='alter-equipamento')
]