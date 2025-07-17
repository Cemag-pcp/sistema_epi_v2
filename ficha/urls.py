from django.urls import path
from . import views

app_name = 'ficha'

urlpatterns = [
    path('ficha/', views.template_ficha, name='ficha'),
    path('ficha/<int:id>/', views.gerar_ficha_epi, name='gerar_ficha_epi'),
]