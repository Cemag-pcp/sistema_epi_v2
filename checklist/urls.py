from django.urls import path
from . import views

app_name = 'checklist'

# templates
urlpatterns = [
    path('', views.checklist, name='checklist'),
    path('add/', views.create, name='add'),
    path('<int:id>/', views.edit_checklist, name='edit_checklist'),
    path('historico/', views.historico, name='historico_checklist'),
]