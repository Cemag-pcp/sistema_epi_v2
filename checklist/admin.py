from django.contrib import admin
from .models import Checklist, Pergunta, Inspecao, ItemResposta

# Register your models here.
admin.site.register(Checklist)
admin.site.register(Pergunta)
admin.site.register(Inspecao)
admin.site.register(ItemResposta)