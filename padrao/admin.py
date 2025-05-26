from django.contrib import admin
from .models import Padrao, PadraoEquipamento, PadraoFuncionario

admin.site.register(Padrao)
admin.site.register(PadraoEquipamento)
admin.site.register(PadraoFuncionario)