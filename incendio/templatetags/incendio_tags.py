from django import template
from django.utils.html import format_html

register = template.Library()

RESULTADO_BADGE = {
    'ok': ('bg-success', 'OK'),
    'nok': ('bg-danger', 'NOK'),
    'na': ('bg-secondary', 'N/A'),
}

STATUS_CLASSE = {
    'aprovado': 'status-approved',
    'reprovado': 'status-declined',
    'nao_avaliado': 'status-peding',
}


@register.filter
def badge_resultado(valor):
    classe, texto = RESULTADO_BADGE.get(valor, ('bg-light text-dark', '-'))
    return format_html('<span class="badge {}">{}</span>', classe, texto)


@register.simple_tag
def badge_status(inspecao):
    return format_html(
        '<span class="badge rounded-pill {}">{}</span>',
        STATUS_CLASSE.get(inspecao.status, ''), inspecao.get_status_display(),
    )
