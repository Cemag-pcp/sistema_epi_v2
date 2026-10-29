import base64
import json
import uuid
from decimal import Decimal, InvalidOperation
from io import BytesIO

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from reportlab.graphics import renderPDF, renderSVG
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from usuario.decorators import somente_master
from .models import (
    RESULTADO_CHOICES, ComponenteHidrante, Extintor, FotoInspecao, Hidrante, HistoricoEquipamento,
    InspecaoExtintor, InspecaoHidrante, ItemInspecaoHidrante, primeiro_dia_mes,
)

RESULTADOS_VALIDOS = {valor for valor, _ in RESULTADO_CHOICES}
RESULTADO_LABEL = dict(RESULTADO_CHOICES)


# =============================================================================
# Auxiliares
# =============================================================================

def _erro(mensagem, status=400, **extra):
    return JsonResponse({'success': False, 'message': mensagem, **extra}, status=status)


def _ler_json(request):
    try:
        return json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        raise ValueError('Formato JSON inválido')


def _nome_usuario(usuario):
    return usuario.nome if usuario else '-'


def _mes_ano(data):
    return data.strftime('%m/%Y') if data else ''


def _registrar_historico(acao, descricao, usuario, extintor=None, hidrante=None):
    HistoricoEquipamento.objects.create(
        extintor=extintor, hidrante=hidrante, acao=acao, descricao=descricao, usuario=usuario
    )


def _descrever_alteracoes(antes, depois, rotulos):
    """Monta 'Campo: antigo → novo' para cada campo que mudou."""
    mudancas = []
    for campo, rotulo in rotulos.items():
        valor_antes, valor_depois = antes.get(campo), depois.get(campo)
        if (valor_antes or '') != (valor_depois or ''):
            mudancas.append(f'{rotulo}: {valor_antes or "-"} → {valor_depois or "-"}')
    return '; '.join(mudancas)


def _url_absoluta(request, caminho):
    url = request.build_absolute_uri(caminho)
    # No Render o HTTPS termina no proxy, então o Django enxerga a requisição como http
    if not settings.DEBUG and url.startswith('http://'):
        url = 'https://' + url[len('http://'):]
    return url


def _salvar_fotos(fotos, **destino):
    """Recebe [{'dados': 'data:image/jpeg;base64,...', 'nome': ...}] e grava no S3."""
    for foto in fotos or []:
        dados = foto.get('dados', '')
        if ';base64,' not in dados:
            dados = f'data:image/jpeg;base64,{dados}'
        formato, conteudo = dados.split(';base64,')
        extensao = formato.split('/')[-1] or 'jpeg'
        arquivo = ContentFile(base64.b64decode(conteudo), name=f'{uuid.uuid4().hex[:12]}.{extensao}')
        FotoInspecao.objects.create(foto=arquivo, descricao=foto.get('nome') or None, **destino)


def _remover_fotos(inspecao, ids):
    if ids:
        inspecao.fotos.filter(id__in=ids).delete()


def _fotos_json(inspecao):
    fotos = []
    for foto in inspecao.fotos.all():
        try:
            url = foto.foto.url
        except Exception:
            url = ''
        fotos.append({'id': foto.id, 'url': url, 'nome': foto.descricao or ''})
    return fotos


def _validar_resultado(valor, rotulo):
    if valor not in RESULTADOS_VALIDOS:
        raise ValueError(f'Responda o item "{rotulo}" (OK, NOK ou N/A)')
    return valor


# =============================================================================
# Extintores - serialização e validação
# =============================================================================

ROTULOS_EXTINTOR = {
    'codigo': 'Código',
    'localizacao': 'Localização',
    'numero_cilindro': 'Nº do cilindro',
    'agente': 'Tipo',
    'capacidade_kg': 'Capacidade (kg)',
    'proxima_recarga': 'Próxima recarga',
    'teste_hidrostatico_ano': 'Teste hidrostático',
}


def _extintor_json(extintor):
    return {
        'id': extintor.id,
        'codigo': extintor.codigo,
        'localizacao': extintor.localizacao,
        'numero_cilindro': extintor.numero_cilindro or '',
        'agente': extintor.agente,
        'capacidade_kg': str(extintor.capacidade_kg.normalize()) if extintor.capacidade_kg is not None else '',
        # 'AAAA-MM' é o formato do <input type="month">
        'proxima_recarga': extintor.proxima_recarga.strftime('%Y-%m') if extintor.proxima_recarga else '',
        'proxima_recarga_display': _mes_ano(extintor.proxima_recarga),
        'teste_hidrostatico_ano': extintor.teste_hidrostatico_ano or '',
        'recarga_vencida': extintor.recarga_vencida,
        'teste_hidrostatico_vencido': extintor.teste_hidrostatico_vencido,
        'situacao_sugerida': extintor.situacao_sugerida(),
        'ativo': extintor.ativo,
        'url_inspecao': reverse('incendio:inspecao-extintor', args=[extintor.qr_token]),
    }


def _extintor_snapshot(extintor):
    """Valores legíveis usados para descrever as alterações no histórico."""
    return {
        'codigo': extintor.codigo,
        'localizacao': extintor.localizacao,
        'numero_cilindro': extintor.numero_cilindro,
        'agente': extintor.agente,
        'capacidade_kg': f'{extintor.capacidade_kg.normalize()}' if extintor.capacidade_kg is not None else '',
        'proxima_recarga': _mes_ano(extintor.proxima_recarga),
        'teste_hidrostatico_ano': str(extintor.teste_hidrostatico_ano or ''),
    }


def _preencher_extintor(extintor, data):
    codigo = (data.get('codigo') or '').strip().upper()
    localizacao = (data.get('localizacao') or '').strip()
    if not codigo or not localizacao:
        raise ValueError('Código e localização são obrigatórios')

    try:
        capacidade = Decimal(str(data.get('capacidade_kg', '')).replace(',', '.'))
    except InvalidOperation:
        raise ValueError('Informe a capacidade em kg')
    if capacidade <= 0:
        raise ValueError('A capacidade deve ser maior que 0')

    try:
        proxima_recarga = primeiro_dia_mes(data.get('proxima_recarga'))
    except (ValueError, TypeError):
        raise ValueError('Próxima recarga inválida (use mês/ano)')

    teste = data.get('teste_hidrostatico_ano')
    try:
        teste = int(teste) if teste not in (None, '') else None
    except (ValueError, TypeError):
        raise ValueError('Ano do teste hidrostático inválido')

    extintor.codigo = codigo
    extintor.localizacao = localizacao
    extintor.numero_cilindro = (str(data.get('numero_cilindro') or '')).strip() or None
    extintor.agente = data.get('agente') or ''
    extintor.capacidade_kg = capacidade
    extintor.proxima_recarga = proxima_recarga
    extintor.teste_hidrostatico_ano = teste
    extintor.full_clean()


# =============================================================================
# Hidrantes - serialização e validação
# =============================================================================

def _hidrante_json(hidrante):
    return {
        'id': hidrante.id,
        'codigo': hidrante.codigo,
        'localizacao': hidrante.localizacao,
        'componentes': [
            {'id': c.id, 'nome': c.nome, 'quantidade': c.quantidade}
            for c in hidrante.componentes.all()
        ],
        'componentes_display': hidrante.descricao_componentes(),
        'ativo': hidrante.ativo,
        'url_inspecao': reverse('incendio:inspecao-hidrante', args=[hidrante.qr_token]),
    }


def _hidrante_snapshot(hidrante):
    return {
        'codigo': hidrante.codigo,
        'localizacao': hidrante.localizacao,
        'componentes': hidrante.descricao_componentes(),
    }


def _preencher_hidrante(hidrante, data):
    codigo = (data.get('codigo') or '').strip().upper()
    localizacao = (data.get('localizacao') or '').strip()
    if not codigo or not localizacao:
        raise ValueError('Código e localização são obrigatórios')

    componentes = []
    for ordem, componente in enumerate(data.get('componentes') or []):
        nome = (componente.get('nome') or '').strip()
        if not nome:
            continue
        quantidade = componente.get('quantidade')
        try:
            quantidade = int(quantidade) if quantidade not in (None, '') else None
        except (ValueError, TypeError):
            raise ValueError(f'Quantidade inválida para "{nome}"')
        if quantidade is not None and quantidade < 0:
            raise ValueError(f'Quantidade inválida para "{nome}"')
        componentes.append({'id': componente.get('id'), 'nome': nome, 'quantidade': quantidade, 'ordem': ordem})

    hidrante.codigo = codigo
    hidrante.localizacao = localizacao
    hidrante.full_clean()
    return componentes


def _salvar_componentes(hidrante, componentes):
    """Atualiza os componentes existentes pelo id, cria os novos e remove os que saíram da lista.
    Componentes removidos não apagam as inspeções antigas (o item guarda o nome e as quantidades)."""
    manter = []
    for dados in componentes:
        componente = None
        if dados['id']:
            componente = hidrante.componentes.filter(id=dados['id']).first()
        if componente is None:
            componente = ComponenteHidrante(hidrante=hidrante)
        componente.nome = dados['nome']
        componente.quantidade = dados['quantidade']
        componente.ordem = dados['ordem']
        componente.save()
        manter.append(componente.id)
    hidrante.componentes.exclude(id__in=manter).delete()


# =============================================================================
# Páginas
# =============================================================================

def _inicio_mes():
    return timezone.localdate().replace(day=1)


@login_required
@somente_master
def cadastros(request):
    # As tabelas são montadas no navegador a partir destes dados (criar/editar atualiza a linha sem recarregar)
    return render(request, 'incendio/cadastros.html', {
        'extintores': [_extintor_json(e) for e in Extintor.objects.all()],
        'hidrantes': [_hidrante_json(h) for h in Hidrante.objects.prefetch_related('componentes')],
        'agentes': Extintor.AGENTE_CHOICES,
    })


@login_required
@somente_master
def extintores(request):
    inspecoes = InspecaoExtintor.objects.select_related('inspetor', 'extintor')
    ativos = list(Extintor.objects.filter(ativo=True))
    inspecionados_mes = set(
        InspecaoExtintor.objects.filter(data_inspecao__date__gte=_inicio_mes())
        .values_list('extintor_id', flat=True)
    )
    indicadores = {
        'total': len(ativos),
        'inspecionados': len([e for e in ativos if e.id in inspecionados_mes]),
        'pendentes': len([e for e in ativos if e.id not in inspecionados_mes]),
        'reprovados_mes': InspecaoExtintor.objects.filter(
            data_inspecao__date__gte=_inicio_mes(), status='reprovado'
        ).count(),
        'vencidos': len([e for e in ativos if e.recarga_vencida or e.teste_hidrostatico_vencido]),
        'a_vencer': len([e for e in ativos if e.vence_em_dias(30)]),
    }
    return render(request, 'incendio/extintores.html', {
        'inspecoes': inspecoes,
        'equipamentos': ativos,
        'pendentes': [e for e in ativos if e.id not in inspecionados_mes],
        'indicadores': indicadores,
    })


@login_required
@somente_master
def hidrantes(request):
    inspecoes = InspecaoHidrante.objects.select_related('inspetor', 'hidrante')
    ativos = list(Hidrante.objects.filter(ativo=True))
    inspecionados_mes = set(
        InspecaoHidrante.objects.filter(data_inspecao__date__gte=_inicio_mes())
        .values_list('hidrante_id', flat=True)
    )
    indicadores = {
        'total': len(ativos),
        'inspecionados': len([h for h in ativos if h.id in inspecionados_mes]),
        'pendentes': len([h for h in ativos if h.id not in inspecionados_mes]),
        'reprovados_mes': InspecaoHidrante.objects.filter(
            data_inspecao__date__gte=_inicio_mes(), status='reprovado'
        ).count(),
        'falta_mes': InspecaoHidrante.objects.filter(
            data_inspecao__date__gte=_inicio_mes(), falta_equipamento=True
        ).count(),
    }
    return render(request, 'incendio/hidrantes.html', {
        'inspecoes': inspecoes,
        'equipamentos': ativos,
        'pendentes': [h for h in ativos if h.id not in inspecionados_mes],
        'indicadores': indicadores,
    })


@login_required
@somente_master
def inspecao_extintor(request, token):
    """Destino do QR Code: abre a inspeção daquele extintor."""
    extintor = get_object_or_404(Extintor, qr_token=token)
    return render(request, 'incendio/inspecao.html', {
        'tipo': 'extintor',
        'equipamento': extintor,
        'dados_iniciais': {
            'tipo': 'extintor',
            'equipamento': _extintor_json(extintor),
            'inspecao': None,
        },
    })


@login_required
@somente_master
def editar_inspecao_extintor(request, id):
    inspecao = get_object_or_404(InspecaoExtintor.objects.select_related('extintor'), id=id)
    return render(request, 'incendio/inspecao.html', {
        'tipo': 'extintor',
        'equipamento': inspecao.extintor,
        'edicao': True,
        'dados_iniciais': {
            'tipo': 'extintor',
            'equipamento': _extintor_json(inspecao.extintor),
            'inspecao': _inspecao_extintor_json(inspecao),
        },
    })


@login_required
@somente_master
def inspecao_hidrante(request, token):
    hidrante = get_object_or_404(Hidrante.objects.prefetch_related('componentes'), qr_token=token)
    return render(request, 'incendio/inspecao.html', {
        'tipo': 'hidrante',
        'equipamento': hidrante,
        'dados_iniciais': {
            'tipo': 'hidrante',
            'equipamento': _hidrante_json(hidrante),
            'inspecao': None,
        },
    })


@login_required
@somente_master
def editar_inspecao_hidrante(request, id):
    inspecao = get_object_or_404(InspecaoHidrante.objects.select_related('hidrante'), id=id)
    return render(request, 'incendio/inspecao.html', {
        'tipo': 'hidrante',
        'equipamento': inspecao.hidrante,
        'edicao': True,
        'dados_iniciais': {
            'tipo': 'hidrante',
            'equipamento': _hidrante_json(inspecao.hidrante),
            'inspecao': _inspecao_hidrante_json(inspecao),
        },
    })


# =============================================================================
# API - Cadastro de extintores
# =============================================================================

@login_required
@somente_master
@require_http_methods(['POST'])
def extintor_create_api(request):
    try:
        data = _ler_json(request)
        extintor = Extintor()
        _preencher_extintor(extintor, data)
        extintor.ativo = bool(data.get('ativo', True))
        with transaction.atomic():
            extintor.save()
            _registrar_historico('criado', f'Extintor {extintor.codigo} cadastrado', request.user, extintor=extintor)
        return JsonResponse({'success': True, 'message': 'Extintor cadastrado com sucesso',
                             'extintor': _extintor_json(extintor)})
    except ValidationError as e:
        return _erro(_mensagem_validacao(e), errors=e.message_dict)
    except ValueError as e:
        return _erro(str(e))


@login_required
@somente_master
@require_http_methods(['GET', 'PUT', 'PATCH'])
def extintor_api(request, id):
    extintor = Extintor.objects.filter(id=id).first()
    if not extintor:
        return _erro('Extintor não encontrado', status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'extintor': _extintor_json(extintor)})

    if request.method == 'PATCH':
        extintor.ativo = not extintor.ativo
        with transaction.atomic():
            extintor.save()
            _registrar_historico('ativado' if extintor.ativo else 'desativado', '', request.user, extintor=extintor)
        return JsonResponse({
            'success': True,
            'message': f'Extintor {"ativado" if extintor.ativo else "desativado"} com sucesso',
            'novo_status': extintor.ativo,
        })

    try:
        data = _ler_json(request)
        antes = _extintor_snapshot(extintor)
        _preencher_extintor(extintor, data)
        descricao = _descrever_alteracoes(antes, _extintor_snapshot(extintor), ROTULOS_EXTINTOR)
        with transaction.atomic():
            extintor.save()
            if descricao:
                _registrar_historico('editado', descricao, request.user, extintor=extintor)
        return JsonResponse({'success': True, 'message': 'Extintor atualizado com sucesso',
                             'extintor': _extintor_json(extintor)})
    except ValidationError as e:
        return _erro(_mensagem_validacao(e), errors=e.message_dict)
    except ValueError as e:
        return _erro(str(e))


# =============================================================================
# API - Cadastro de hidrantes
# =============================================================================

@login_required
@somente_master
@require_http_methods(['POST'])
def hidrante_create_api(request):
    try:
        data = _ler_json(request)
        hidrante = Hidrante()
        componentes = _preencher_hidrante(hidrante, data)
        hidrante.ativo = bool(data.get('ativo', True))
        with transaction.atomic():
            hidrante.save()
            _salvar_componentes(hidrante, componentes)
            _registrar_historico(
                'criado', f'Hidrante {hidrante.codigo} cadastrado: {hidrante.descricao_componentes() or "sem componentes"}',
                request.user, hidrante=hidrante,
            )
        return JsonResponse({'success': True, 'message': 'Hidrante cadastrado com sucesso',
                             'hidrante': _hidrante_json(hidrante)})
    except ValidationError as e:
        return _erro(_mensagem_validacao(e), errors=e.message_dict)
    except ValueError as e:
        return _erro(str(e))


@login_required
@somente_master
@require_http_methods(['GET', 'PUT', 'PATCH'])
def hidrante_api(request, id):
    hidrante = Hidrante.objects.filter(id=id).first()
    if not hidrante:
        return _erro('Hidrante não encontrado', status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'hidrante': _hidrante_json(hidrante)})

    if request.method == 'PATCH':
        hidrante.ativo = not hidrante.ativo
        with transaction.atomic():
            hidrante.save()
            _registrar_historico('ativado' if hidrante.ativo else 'desativado', '', request.user, hidrante=hidrante)
        return JsonResponse({
            'success': True,
            'message': f'Hidrante {"ativado" if hidrante.ativo else "desativado"} com sucesso',
            'novo_status': hidrante.ativo,
        })

    try:
        data = _ler_json(request)
        antes = _hidrante_snapshot(hidrante)
        componentes = _preencher_hidrante(hidrante, data)
        with transaction.atomic():
            hidrante.save()
            _salvar_componentes(hidrante, componentes)
            descricao = _descrever_alteracoes(antes, _hidrante_snapshot(hidrante), {
                'codigo': 'Código', 'localizacao': 'Localização', 'componentes': 'Componentes',
            })
            if descricao:
                _registrar_historico('editado', descricao, request.user, hidrante=hidrante)
        return JsonResponse({'success': True, 'message': 'Hidrante atualizado com sucesso',
                             'hidrante': _hidrante_json(hidrante)})
    except ValidationError as e:
        return _erro(_mensagem_validacao(e), errors=e.message_dict)
    except ValueError as e:
        return _erro(str(e))


def _mensagem_validacao(e):
    if 'codigo' in getattr(e, 'message_dict', {}):
        return 'Já existe um equipamento com esse código'
    return 'Erro de validação: ' + '; '.join(e.messages)


@login_required
@somente_master
@require_http_methods(['GET'])
def historico_api(request, tipo, id):
    filtro = {'extintor_id': id} if tipo == 'extintor' else {'hidrante_id': id}
    registros = HistoricoEquipamento.objects.filter(**filtro).select_related('usuario')
    return JsonResponse({'success': True, 'historico': [
        {
            'data': timezone.localtime(r.data).strftime('%d/%m/%Y %H:%M'),
            'acao': r.acao,
            'acao_display': r.get_acao_display(),
            'descricao': r.descricao,
            'usuario': _nome_usuario(r.usuario),
        }
        for r in registros
    ]})


# =============================================================================
# API - Inspeções de extintor
# =============================================================================

ROTULOS_ITENS_EXTINTOR = {
    'situacao': 'Situação (validade)',
    'estado': 'Estado',
    'manometro': 'Manômetro',
    'lacre': 'Lacre íntegro',
}


def _inspecao_extintor_json(inspecao):
    return {
        'id': inspecao.id,
        'extintor_id': inspecao.extintor_id,
        'data': timezone.localtime(inspecao.data_inspecao).strftime('%d/%m/%Y %H:%M'),
        'inspetor': _nome_usuario(inspecao.inspetor),
        'codigo': inspecao.codigo_historico,
        'localizacao': inspecao.localizacao_historico,
        'numero_cilindro': inspecao.numero_cilindro_historico or '',
        'agente': inspecao.agente_historico,
        'capacidade_kg': str(inspecao.capacidade_kg_historico.normalize()),
        'proxima_recarga': _mes_ano(inspecao.proxima_recarga_historico),
        'teste_hidrostatico_ano': inspecao.teste_hidrostatico_ano_historico or '',
        'itens': [
            {'campo': campo, 'rotulo': rotulo, 'resultado': getattr(inspecao, campo),
             'resultado_display': RESULTADO_LABEL[getattr(inspecao, campo)]}
            for campo, rotulo in ROTULOS_ITENS_EXTINTOR.items()
        ],
        'status': inspecao.status,
        'status_display': inspecao.get_status_display(),
        'observacao': inspecao.observacao or '',
        'fotos': _fotos_json(inspecao),
        'url_editar': reverse('incendio:editar-inspecao-extintor', args=[inspecao.id]),
    }


def _preencher_inspecao_extintor(inspecao, data):
    for campo, rotulo in ROTULOS_ITENS_EXTINTOR.items():
        setattr(inspecao, campo, _validar_resultado(data.get(campo), rotulo))
    inspecao.observacao = (data.get('observacao') or '').strip() or None
    if 'nok' in (getattr(inspecao, c) for c in ROTULOS_ITENS_EXTINTOR) and not inspecao.observacao:
        raise ValueError('Descreva na observação o motivo dos itens NOK')
    inspecao.atualizar_status()


@login_required
@somente_master
@require_http_methods(['POST'])
def inspecao_extintor_create_api(request):
    try:
        data = _ler_json(request)
        extintor = Extintor.objects.filter(id=data.get('extintor'), ativo=True).first()
        if not extintor:
            return _erro('Extintor não encontrado ou desativado', status=404)

        inspecao = InspecaoExtintor(extintor=extintor, inspetor=request.user)
        inspecao.copiar_dados_extintor()
        _preencher_inspecao_extintor(inspecao, data)
        with transaction.atomic():
            inspecao.save()
            _salvar_fotos(data.get('fotos'), inspecao_extintor=inspecao)
            _registrar_historico(
                'inspecionado', f'Inspeção #{inspecao.id}: {inspecao.get_status_display()}',
                request.user, extintor=extintor,
            )
        return JsonResponse({'success': True, 'message': 'Inspeção registrada com sucesso',
                             'inspecao': _inspecao_extintor_json(inspecao)})
    except ValueError as e:
        return _erro(str(e))


@login_required
@somente_master
@require_http_methods(['GET', 'PUT', 'DELETE'])
def inspecao_extintor_api(request, id):
    inspecao = InspecaoExtintor.objects.select_related('extintor', 'inspetor').filter(id=id).first()
    if not inspecao:
        return _erro('Inspeção não encontrada', status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'inspecao': _inspecao_extintor_json(inspecao)})

    if request.method == 'DELETE':
        with transaction.atomic():
            _registrar_historico(
                'inspecao_excluida',
                f'Inspeção #{inspecao.id} de {timezone.localtime(inspecao.data_inspecao):%d/%m/%Y} excluída',
                request.user, extintor=inspecao.extintor,
            )
            inspecao.delete()
        return JsonResponse({'success': True, 'message': 'Inspeção excluída com sucesso'})

    try:
        data = _ler_json(request)
        antes = {c: RESULTADO_LABEL[getattr(inspecao, c)] for c in ROTULOS_ITENS_EXTINTOR}
        antes['status'] = inspecao.get_status_display()
        _preencher_inspecao_extintor(inspecao, data)
        depois = {c: RESULTADO_LABEL[getattr(inspecao, c)] for c in ROTULOS_ITENS_EXTINTOR}
        depois['status'] = inspecao.get_status_display()
        descricao = _descrever_alteracoes(antes, depois, {**ROTULOS_ITENS_EXTINTOR, 'status': 'Status'})
        with transaction.atomic():
            inspecao.save()
            _remover_fotos(inspecao, data.get('fotos_remover'))
            _salvar_fotos(data.get('fotos'), inspecao_extintor=inspecao)
            _registrar_historico(
                'inspecao_editada', f'Inspeção #{inspecao.id}' + (f' - {descricao}' if descricao else ''),
                request.user, extintor=inspecao.extintor,
            )
        return JsonResponse({'success': True, 'message': 'Inspeção atualizada com sucesso',
                             'inspecao': _inspecao_extintor_json(inspecao)})
    except ValueError as e:
        return _erro(str(e))


# =============================================================================
# API - Inspeções de hidrante
# =============================================================================

def _inspecao_hidrante_json(inspecao):
    return {
        'id': inspecao.id,
        'hidrante_id': inspecao.hidrante_id,
        'data': timezone.localtime(inspecao.data_inspecao).strftime('%d/%m/%Y %H:%M'),
        'inspetor': _nome_usuario(inspecao.inspetor),
        'codigo': inspecao.codigo_historico,
        'localizacao': inspecao.localizacao_historico,
        'funcionamento': inspecao.funcionamento,
        'funcionamento_display': RESULTADO_LABEL[inspecao.funcionamento],
        'itens': [
            {
                'id': item.id,
                'componente_id': item.componente_id,
                'nome': item.nome,
                'quantidade_prevista': item.quantidade_prevista,
                'quantidade_encontrada': item.quantidade_encontrada,
                'resultado': item.resultado,
                'resultado_display': RESULTADO_LABEL[item.resultado],
            }
            for item in inspecao.itens.all()
        ],
        'falta_equipamento': inspecao.falta_equipamento,
        'falta_descricao': inspecao.falta_descricao or '',
        'status': inspecao.status,
        'status_display': inspecao.get_status_display(),
        'observacao': inspecao.observacao or '',
        'fotos': _fotos_json(inspecao),
        'url_editar': reverse('incendio:editar-inspecao-hidrante', args=[inspecao.id]),
    }


def _ler_itens_hidrante(data):
    itens = []
    for item in data.get('itens') or []:
        nome = (item.get('nome') or '').strip()
        resultado = _validar_resultado(item.get('resultado'), nome or 'componente')
        encontrada = item.get('quantidade_encontrada')
        try:
            encontrada = int(encontrada) if encontrada not in (None, '') else None
        except (ValueError, TypeError):
            raise ValueError(f'Quantidade encontrada inválida para "{nome}"')
        if encontrada is not None and encontrada < 0:
            raise ValueError(f'Quantidade encontrada inválida para "{nome}"')
        itens.append({**item, 'nome': nome, 'resultado': resultado, 'quantidade_encontrada': encontrada})
    return itens


def _validar_inspecao_hidrante(inspecao, itens, data):
    inspecao.funcionamento = _validar_resultado(data.get('funcionamento'), 'Equipamento funciona perfeitamente?')
    inspecao.observacao = (data.get('observacao') or '').strip() or None
    tem_nok = inspecao.funcionamento == 'nok' or any(i['resultado'] == 'nok' for i in itens)
    if tem_nok and not inspecao.observacao:
        raise ValueError('Descreva na observação o motivo dos itens NOK')


@login_required
@somente_master
@require_http_methods(['POST'])
def inspecao_hidrante_create_api(request):
    try:
        data = _ler_json(request)
        hidrante = Hidrante.objects.filter(id=data.get('hidrante'), ativo=True).first()
        if not hidrante:
            return _erro('Hidrante não encontrado ou desativado', status=404)

        inspecao = InspecaoHidrante(
            hidrante=hidrante, inspetor=request.user,
            codigo_historico=hidrante.codigo, localizacao_historico=hidrante.localizacao,
        )
        itens = _ler_itens_hidrante(data)
        _validar_inspecao_hidrante(inspecao, itens, data)

        # Os itens vêm dos componentes cadastrados; nome e quantidade prevista são copiados daqui,
        # não do navegador, para o histórico refletir o cadastro no momento da inspeção.
        componentes = {c.id: c for c in hidrante.componentes.all()}
        if set(componentes) - {i.get('componente_id') for i in itens}:
            raise ValueError('Responda todos os componentes do hidrante')
        with transaction.atomic():
            inspecao.status = 'nao_avaliado'
            inspecao.save()
            for item in itens:
                componente = componentes.get(item.get('componente_id'))
                if not componente:
                    continue
                ItemInspecaoHidrante.objects.create(
                    inspecao=inspecao, componente=componente, nome=componente.nome,
                    quantidade_prevista=componente.quantidade,
                    quantidade_encontrada=item['quantidade_encontrada'] if componente.quantidade is not None else None,
                    resultado=item['resultado'],
                )
            inspecao.atualizar_resumo()
            inspecao.save()
            _salvar_fotos(data.get('fotos'), inspecao_hidrante=inspecao)
            _registrar_historico(
                'inspecionado', f'Inspeção #{inspecao.id}: {inspecao.get_status_display()}'
                + (f' - Falta: {inspecao.falta_descricao}' if inspecao.falta_equipamento else ''),
                request.user, hidrante=hidrante,
            )
        return JsonResponse({'success': True, 'message': 'Inspeção registrada com sucesso',
                             'inspecao': _inspecao_hidrante_json(inspecao)})
    except ValueError as e:
        return _erro(str(e))


@login_required
@somente_master
@require_http_methods(['GET', 'PUT', 'DELETE'])
def inspecao_hidrante_api(request, id):
    inspecao = InspecaoHidrante.objects.select_related('hidrante', 'inspetor').filter(id=id).first()
    if not inspecao:
        return _erro('Inspeção não encontrada', status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'inspecao': _inspecao_hidrante_json(inspecao)})

    if request.method == 'DELETE':
        with transaction.atomic():
            _registrar_historico(
                'inspecao_excluida',
                f'Inspeção #{inspecao.id} de {timezone.localtime(inspecao.data_inspecao):%d/%m/%Y} excluída',
                request.user, hidrante=inspecao.hidrante,
            )
            inspecao.delete()
        return JsonResponse({'success': True, 'message': 'Inspeção excluída com sucesso'})

    try:
        data = _ler_json(request)
        status_antes = inspecao.get_status_display()
        itens = _ler_itens_hidrante(data)
        _validar_inspecao_hidrante(inspecao, itens, data)
        # Na edição só se alteram as respostas dos itens que já existem na inspeção
        respostas = {i.get('id'): i for i in itens}
        with transaction.atomic():
            for item in inspecao.itens.all():
                resposta = respostas.get(item.id)
                if not resposta:
                    continue
                item.resultado = resposta['resultado']
                if item.quantidade_prevista is not None:
                    item.quantidade_encontrada = resposta['quantidade_encontrada']
                item.save()
            inspecao.atualizar_resumo()
            inspecao.save()
            _remover_fotos(inspecao, data.get('fotos_remover'))
            _salvar_fotos(data.get('fotos'), inspecao_hidrante=inspecao)
            status_depois = inspecao.get_status_display()
            mudanca = f' - Status: {status_antes} → {status_depois}' if status_antes != status_depois else ''
            _registrar_historico(
                'inspecao_editada', f'Inspeção #{inspecao.id}{mudanca}', request.user, hidrante=inspecao.hidrante,
            )
        return JsonResponse({'success': True, 'message': 'Inspeção atualizada com sucesso',
                             'inspecao': _inspecao_hidrante_json(inspecao)})
    except ValueError as e:
        return _erro(str(e))


# =============================================================================
# QR Code e etiquetas
# =============================================================================

def _equipamento_por_tipo(tipo, id):
    modelo = Extintor if tipo == 'extintor' else Hidrante
    return get_object_or_404(modelo, id=id)


def _url_qr(request, tipo, equipamento):
    nome_url = 'incendio:inspecao-extintor' if tipo == 'extintor' else 'incendio:inspecao-hidrante'
    return _url_absoluta(request, reverse(nome_url, args=[equipamento.qr_token]))


def _desenho_qr(conteudo, tamanho):
    widget = QrCodeWidget(conteudo, barLevel='M')
    x1, y1, x2, y2 = widget.getBounds()
    largura, altura = x2 - x1, y2 - y1
    desenho = Drawing(tamanho, tamanho, transform=[tamanho / largura, 0, 0, tamanho / altura, 0, 0])
    desenho.add(widget)
    return desenho


@login_required
@somente_master
def qrcode_svg(request, tipo, id):
    equipamento = _equipamento_por_tipo(tipo, id)
    svg = renderSVG.drawToString(_desenho_qr(_url_qr(request, tipo, equipamento), 220))
    return HttpResponse(svg, content_type='image/svg+xml')


@login_required
@somente_master
def etiquetas_pdf(request):
    """Etiquetas com QR Code em folha A4 (3 colunas x 4 linhas). ?tipo=extintor|hidrante&ids=1,2,3"""
    tipo = request.GET.get('tipo', 'extintor')
    modelo = Extintor if tipo == 'extintor' else Hidrante
    equipamentos = modelo.objects.filter(ativo=True)
    ids = [int(i) for i in request.GET.get('ids', '').split(',') if i.strip().isdigit()]
    if ids:
        equipamentos = equipamentos.filter(id__in=ids)

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle('Etiquetas QR Code - Combate a Incêndio')
    largura_pagina, altura_pagina = A4
    colunas, linhas = 3, 4
    margem = 10 * mm
    largura = (largura_pagina - 2 * margem) / colunas
    altura = (altura_pagina - 2 * margem) / linhas
    tamanho_qr = min(largura, altura) - 26 * mm

    for indice, equipamento in enumerate(equipamentos):
        posicao = indice % (colunas * linhas)
        if indice and posicao == 0:
            pdf.showPage()
        coluna, linha = posicao % colunas, posicao // colunas
        x = margem + coluna * largura
        y = altura_pagina - margem - (linha + 1) * altura

        pdf.setDash(3, 3)
        pdf.setStrokeColorRGB(0.7, 0.7, 0.7)
        pdf.rect(x + 2 * mm, y + 2 * mm, largura - 4 * mm, altura - 4 * mm)
        pdf.setDash()

        pdf.setFont('Helvetica-Bold', 9)
        pdf.drawCentredString(x + largura / 2, y + altura - 9 * mm, 'COMBATE A INCÊNDIO - INSPEÇÃO')
        renderPDF.draw(
            _desenho_qr(_url_qr(request, tipo, equipamento), tamanho_qr), pdf,
            x + (largura - tamanho_qr) / 2, y + 14 * mm,
        )
        pdf.setFont('Helvetica-Bold', 16)
        pdf.drawCentredString(x + largura / 2, y + 7 * mm, equipamento.codigo)

    if not equipamentos:
        pdf.setFont('Helvetica', 12)
        pdf.drawString(margem, altura_pagina - margem - 12, 'Nenhum equipamento ativo selecionado.')
    pdf.save()

    resposta = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    resposta['Content-Disposition'] = f'inline; filename="etiquetas_{tipo}.pdf"'
    return resposta
