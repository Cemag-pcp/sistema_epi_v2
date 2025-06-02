from django.urls import path
from . import views

app_name = 'equipamento'

# templates
urlpatterns = [
    path('', views.equipamento, name='equipamento'),
]

urlpatterns += [
    path('<int:id>/', views.alter_equipamento, name='alter-equipamento')
]