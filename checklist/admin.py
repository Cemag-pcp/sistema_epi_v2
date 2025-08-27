from django.contrib import admin
from .models import Checklist, Pergunta, Inspecao, ItemResposta, FotoResposta

# Register your models here.
admin.site.register(Checklist)
admin.site.register(Pergunta)
admin.site.register(Inspecao)
admin.site.register(ItemResposta)
admin.site.register(FotoResposta)