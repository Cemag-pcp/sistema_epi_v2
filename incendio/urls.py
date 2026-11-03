from django.urls import path
from . import views, views_manutencao

app_name = 'incendio'

# templates
urlpatterns = [
    path('extintores/', views.extintores, name='extintores'),
    path('hidrantes/', views.hidrantes, name='hidrantes'),
    path('cadastros/', views.cadastros, name='cadastros'),
    path('manutencao/', views_manutencao.manutencao, name='manutencao'),
    path('manutencao/historico/', views_manutencao.historico, name='historico-manutencao'),
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
    path('api/manutencoes/', views_manutencao.enviar_api, name='manutencao-enviar-api'),
    path('api/manutencoes/empresas/', views_manutencao.empresa_create_api, name='empresa-create-api'),
    path('api/manutencoes/<int:id>/', views_manutencao.manutencao_api, name='manutencao-api'),
    path('api/manutencoes/extintor/<int:id>/', views_manutencao.historico_extintor_api, name='manutencao-historico-extintor-api'),
    path('api/manutencoes/<int:id>/receber/', views_manutencao.receber_api, name='manutencao-receber-api'),
    path('api/manutencoes/<int:id>/cancelar/', views_manutencao.cancelar_api, name='manutencao-cancelar-api'),
]
