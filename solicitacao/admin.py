from django.contrib import admin
from .models import Solicitacao, DadosSolicitacao, Assinatura

admin.site.register(Solicitacao)
admin.site.register(DadosSolicitacao)
admin.site.register(Assinatura)
