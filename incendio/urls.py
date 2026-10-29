from django.urls import path
from . import views

app_name = 'incendio'

# templates
urlpatterns = [
    path('extintores/', views.extintores, name='extintores'),
    path('hidrantes/', views.hidrantes, name='hidrantes'),
    path('cadastros/', views.cadastros, name='cadastros'),
    # Destino dos QR Codes colados nos equipamentos
    path('inspecao/extintor/<uuid:token>/', views.inspecao_extintor, name='inspecao-extintor'),
    path('inspecao/hidrante/<uuid:token>/', views.inspecao_hidrante, name='inspecao-hidrante'),
    path('inspecao/extintor/editar/<int:id>/', views.editar_inspecao_extintor, name='editar-inspecao-extintor'),
    path('inspecao/hidrante/editar/<int:id>/', views.editar_inspecao_hidrante, name='editar-inspecao-hidrante'),
    path('etiquetas/', views.etiquetas_pdf, name='etiquetas'),
    path('qrcode/<str:tipo>/<int:id>/', views.qrcode_svg, name='qrcode'),
]

# api
urlpatterns += [
    path('api/extintores/', views.extintor_create_api, name='extintor-create-api'),
    path('api/extintores/<int:id>/', views.extintor_api, name='extintor-api'),
    path('api/hidrantes/', views.hidrante_create_api, name='hidrante-create-api'),
    path('api/hidrantes/<int:id>/', views.hidrante_api, name='hidrante-api'),
    path('api/historico/<str:tipo>/<int:id>/', views.historico_api, name='historico-api'),
    path('api/inspecoes/extintor/', views.inspecao_extintor_create_api, name='inspecao-extintor-create-api'),
    path('api/inspecoes/extintor/<int:id>/', views.inspecao_extintor_api, name='inspecao-extintor-api'),
    path('api/inspecoes/hidrante/', views.inspecao_hidrante_create_api, name='inspecao-hidrante-create-api'),
    path('api/inspecoes/hidrante/<int:id>/', views.inspecao_hidrante_api, name='inspecao-hidrante-api'),
]
