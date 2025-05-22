from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario,Funcionario
from django.utils.translation import gettext_lazy as _

class CustomUsuarioAdmin(UserAdmin):
    model = Usuario

    list_display = ('matricula', 'nome', 'tipo_acesso', 'is_staff', 'is_superuser')
    list_filter = ('is_staff', 'is_superuser', 'tipo_acesso')
    search_fields = ('matricula', 'nome')
    ordering = ('matricula',)

    fieldsets = (
        (None, {'fields': ('matricula', 'password')}),
        (_('Informações Pessoais'), {'fields': ('nome', 'funcionario', 'tipo_acesso')}),
        (_('Permissões'), {'fields': ('is_staff', 'is_superuser')}),
        (_('Datas Importantes'), {'fields': ('last_login',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('matricula', 'nome', 'funcionario', 'tipo_acesso', 'password1', 'password2'),
        }),
    )

admin.site.register(Usuario, CustomUsuarioAdmin)
admin.site.register(Funcionario)
# 

