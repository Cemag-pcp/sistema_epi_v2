from django.urls import path
from . import views

app_name = 'checklist'

# templates
urlpatterns = [
    path('checklists/', views.checklists_template, name='checklist'),
    path('checklists/add/', views.create_template, name='add-checklist'),
    path('checklists/edit/<int:id>/', views.edit_checklist_template, name='edit-checklist'),
    path('checklists/inspection/<int:id>/', views.inspection_checklist_template, name='inspection-checklist'),
    path('checklists/history/', views.history_template, name='history-checklist'),
    path('checklists/inspection/edit/<int:id>/', views.edit_inspection_template, name='edit-inspection'),
]

# api
urlpatterns += [
    path('api/checklists/cards/', views.checklist_cards_data_api, name='checklist-cards-data-api'),
    path('api/checklists/duplicate/', views.duplicate_checklist_api, name='duplicate-checklist-api'),
    path('api/checklists/inspection/', views.inspection_send_checklist_api, name='inspection-send-checklist-api'),
    path('api/checklists/inspection/<int:id>/', views.inspection_checklist_api, name='inspection-checklist-api'),
    path('api/checklists/add/', views.create_checklist_api, name='add-checklist-api'),
    path('api/checklists/edit/<int:id>/', views.edit_checklist_api, name='edit-checklist-api'),
    path('api/checklists/delete/<int:id>/', views.delete_checklist_api, name='delete-checklist-api'),
    path('api/checklists/history/', views.historico_api, name='historico-api'),
    path('api/checklists/inspection/data/<int:id>/', views.inspection_data_api, name='inspection-data-api'),
    path('api/checklists/inspection/update/', views.update_inspection_api, name='update-inspection-api'),
]