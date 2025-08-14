from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('core/', include('core.urls')),
    path('equipamento/', include('equipamento.urls')),
    path('solicitacao/', include('solicitacao.urls')),
    path('padroes/', include('padrao.urls')),
    path('devolucao/', include('devolucao.urls')),
    path('checklist/', include('checklist.urls')),
    path('', include('ficha.urls')),
    path('', include('usuario.urls'))
]
