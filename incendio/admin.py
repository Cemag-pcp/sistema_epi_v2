from django.contrib import admin
from .models import (
    ComponenteHidrante, EmpresaManutencao, Extintor, FotoInspecao, Hidrante, HistoricoEquipamento,
    InspecaoExtintor, InspecaoHidrante, ItemInspecaoHidrante, ManutencaoExtintor,
)


class ComponenteHidranteInline(admin.TabularInline):
    model = ComponenteHidrante
    extra = 0


class ItemInspecaoHidranteInline(admin.TabularInline):
    model = ItemInspecaoHidrante
    extra = 0


@admin.register(Extintor)
class ExtintorAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'localizacao', 'numero_cilindro', 'agente', 'capacidade_kg',
                    'proxima_recarga', 'teste_hidrostatico_ano', 'reserva', 'ativo')
    list_filter = ('agente', 'reserva', 'ativo')
    search_fields = ('codigo', 'localizacao', 'numero_cilindro')


@admin.register(Hidrante)
class HidranteAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'localizacao', 'ativo')
    inlines = [ComponenteHidranteInline]


@admin.register(InspecaoExtintor)
class InspecaoExtintorAdmin(admin.ModelAdmin):
    list_display = ('codigo_historico', 'data_inspecao', 'inspetor', 'status')
    list_filter = ('status',)


@admin.register(InspecaoHidrante)
class InspecaoHidranteAdmin(admin.ModelAdmin):
    list_display = ('codigo_historico', 'data_inspecao', 'inspetor', 'status', 'falta_equipamento')
    list_filter = ('status', 'falta_equipamento')
    inlines = [ItemInspecaoHidranteInline]


@admin.register(ManutencaoExtintor)
class ManutencaoExtintorAdmin(admin.ModelAdmin):
    list_display = ('extintor', 'reserva', 'motivo', 'empresa', 'data_envio', 'data_recebimento', 'status')
    list_filter = ('status', 'motivo', 'empresa')


admin.site.register(EmpresaManutencao)
admin.site.register(FotoInspecao)
admin.site.register(HistoricoEquipamento)
