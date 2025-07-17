from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario, Funcionario, Setor, Cargo
from django.utils.translation import gettext_lazy as _

class CustomUsuarioAdmin(UserAdmin):
    model = Usuario

    list_display = ('matricula', 'nome', 'is_staff', 'is_superuser')
    list_filter = ('is_staff', 'is_superuser')
    search_fields = ('matricula', 'nome')
    ordering = ('matricula',)

    fieldsets = (
        (None, {'fields': ('matricula', 'password')}),
        (_('Informações Pessoais'), {'fields': ('nome', 'funcionario')}),
        (_('Permissões'), {'fields': ('is_staff', 'is_superuser')}),
        (_('Datas Importantes'), {'fields': ('last_login',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('matricula', 'nome', 'funcionario', 'password1', 'password2'),
        }),
    )

admin.site.register(Usuario, CustomUsuarioAdmin)
admin.site.register(Funcionario)
admin.site.register(Setor)
admin.site.register(Cargo)

