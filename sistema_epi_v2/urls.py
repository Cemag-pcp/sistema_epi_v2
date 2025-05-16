from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('core/', include('core.urls')),
    path('equipamento/', include('equipamento.urls')),
    path('', include('usuario.urls')),
]
