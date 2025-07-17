from django.urls import path
from . import views

urlpatterns = [
    path('ficha/', views.template_ficha, name='ficha')
]