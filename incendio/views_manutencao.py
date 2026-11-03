"""Manutenção externa de extintores: envio → reserva no local → recebimento."""
from datetime import date

from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import Count, Max, Q
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from usuario.decorators import somente_master
from .models import (
    LOCAL_MANUTENCAO, LOCAL_RESERVA, EmpresaManutencao, Extintor, ManutencaoExtintor, primeiro_dia_mes,
)
from .views import _erro, _ler_json, _mes_ano, _nome_usuario, _registrar_historico


def _data(valor, rotulo, obrigatoria=True):
    if not valor:
        if obrigatoria:
            raise ValueError(f'Informe a {rotulo}')
        return None
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError:
        raise ValueError(f'{rotulo.capitalize()} inválida')


def _data_br(valor):
    return valor.strftime('%d/%m/%Y') if valor else ''


def _extintor_resumo(extintor):
    if not extintor:
        return None
    return {
        'id': extintor.id,
        'codigo': extintor.codigo,
        'localizacao': extintor.localizacao,
        'agente': extintor.agente,
        'capacidade_kg': str(extintor.capacidade_kg.normalize()),
        'numero_cilindro': extintor.numero_cilindro or '',
        'reserva': extintor.reserva,
        'proxima_recarga': extintor.proxima_recarga.strftime('%Y-%m') if extintor.proxima_recarga else '',
        'teste_hidrostatico_ano': extintor.teste_hidrostatico_ano or '',
    }


def _manutencao_json(m):
    etapas = [{
        'titulo': 'Enviado para manutenção',
        'data': _data_br(m.data_envio),
        'usuario': _nome_usuario(m.enviado_por),
        'descricao': ' • '.join(filter(None, [
            m.get_motivo_display(),
            f'Empresa: {m.empresa}' if m.empresa else None,
            m.observacao_envio,
        ])),
    }, {
        'titulo': 'Reserva no local' if m.reserva else 'Local sem reserva',
        'data': _data_br(m.data_envio),
        'usuario': _nome_usuario(m.enviado_por),
        'descricao': (f'{m.reserva.codigo} assumiu {m.localizacao_original}' if m.reserva
                      else f'{m.localizacao_original} ficou sem extintor'),
    }]
    if m.status == 'recebido':
        if m.reposto:
            destino = f'{m.extintor.codigo} reposto em {m.localizacao_original}'
            if m.reserva:
                destino += f'; {m.reserva.codigo} voltou para {m.localizacao_reserva_anterior or LOCAL_RESERVA}'
        else:
            destino = f'{m.extintor.codigo} passou a ser reserva'
            if m.reserva:
                destino += f'; {m.reserva.codigo} ficou em {m.localizacao_original} como posto fixo'
        etapas.append({
            'titulo': 'Recebido',
            'data': _data_br(m.data_recebimento),
            'usuario': _nome_usuario(m.recebido_por),
            'descricao': ' • '.join(filter(None, [destino, m.observacao_recebimento])),
        })
    elif m.status == 'cancelado':
        etapas.append({
            'titulo': 'Envio cancelado',
            'data': timezone.localtime(m.data_cancelamento).strftime('%d/%m/%Y') if m.data_cancelamento else '',
            'usuario': _nome_usuario(m.cancelado_por),
            'descricao': m.motivo_cancelamento or '',
        })

    hoje = timezone.localdate()
    fim = m.data_recebimento or hoje
    return {
        'id': m.id,
        'status': m.status,
        'status_display': m.get_status_display(),
        'motivo': m.motivo,
        'motivo_display': m.get_motivo_display(),
        'empresa': m.empresa.nome if m.empresa else '',
        'extintor': _extintor_resumo(m.extintor),
        'reserva': _extintor_resumo(m.reserva),
        'localizacao_original': m.localizacao_original,
        'data_envio': _data_br(m.data_envio),
        'data_envio_iso': m.data_envio.isoformat(),
        'data_recebimento': _data_br(m.data_recebimento),
        'dias_fora': (fim - m.data_envio).days,
        'reposto': m.reposto,
        'etapas': etapas,
    }


def _disponiveis():
    """Extintores ativos que não estão fora nem cobrindo outro local."""
    ocupados = ManutencaoExtintor.ids_ocupados()
    return [e for e in Extintor.objects.filter(ativo=True) if e.id not in ocupados]


# =============================================================================
# Página
# =============================================================================

@login_required
@somente_master
def manutencao(request):
    manutencoes = ManutencaoExtintor.objects.select_related(
        'extintor', 'reserva', 'empresa', 'enviado_por', 'recebido_por', 'cancelado_por'
    )
    disponiveis = _disponiveis()
    inicio_mes = timezone.localdate().replace(day=1)
    indicadores = {
        'em_manutencao': manutencoes.filter(status='em_manutencao').count(),
        'sem_reserva': manutencoes.filter(status='em_manutencao', reserva=None).count(),
        'reservas_disponiveis': len([e for e in disponiveis if e.reserva]),
        'recebidos_mes': manutencoes.filter(status='recebido', data_recebimento__gte=inicio_mes).count(),
    }
    return render(request, 'incendio/manutencao.html', {
        'manutencoes': [_manutencao_json(m) for m in manutencoes],
        'disponiveis': [_extintor_resumo(e) for e in disponiveis],
        'indicadores': indicadores,
        'motivos': ManutencaoExtintor.MOTIVO_CHOICES,
        'empresas': EmpresaManutencao.objects.all(),
        'hoje': timezone.localdate().isoformat(),
    })


@login_required
@somente_master
def historico(request):
    """Histórico de manutenções por extintor."""
    validas = ~Q(manutencoes__status='cancelado')
    extintores = Extintor.objects.annotate(
        total_envios=Count('manutencoes', filter=validas, distinct=True),
        ultimo_envio=Max('manutencoes__data_envio', filter=validas),
        total_coberturas=Count('coberturas', filter=~Q(coberturas__status='cancelado'), distinct=True),
    )
    em_manutencao = ManutencaoExtintor.ids_em_manutencao()

    # Motivo da última ida de cada extintor (cancelados não contam)
    ultimas = {}
    for m in (ManutencaoExtintor.objects.exclude(status='cancelado')
              .order_by('extintor_id', '-data_envio', '-id')):
        ultimas.setdefault(m.extintor_id, m)

    linhas = []
    for e in extintores:
        ultima = ultimas.get(e.id)
        linhas.append({
            **_extintor_resumo(e),
            'ativo': e.ativo,
            'total_envios': e.total_envios,
            'total_coberturas': e.total_coberturas,
            'ultimo_envio': _data_br(e.ultimo_envio),
            'ultimo_envio_iso': e.ultimo_envio.isoformat() if e.ultimo_envio else '',
            'ultimo_motivo': ultima.get_motivo_display() if ultima else '',
            'em_manutencao': e.id in em_manutencao,
        })
    return render(request, 'incendio/historico_manutencao.html', {
        'extintores': linhas,
        'agentes': Extintor.AGENTE_CHOICES,
        'abrir': request.GET.get('extintor', ''),
    })


# =============================================================================
# API
# =============================================================================

@login_required
@somente_master
@require_http_methods(['GET'])
def historico_extintor_api(request, id):
    """Manutenções de um extintor (as que ele foi enviado e as que ele cobriu como reserva)."""
    extintor = Extintor.objects.filter(id=id).first()
    if not extintor:
        return _erro('Extintor não encontrado', status=404)

    relacionados = ('extintor', 'reserva', 'empresa', 'enviado_por', 'recebido_por', 'cancelado_por')
    envios = list(ManutencaoExtintor.objects.filter(extintor=extintor).select_related(*relacionados))
    coberturas = list(ManutencaoExtintor.objects.filter(reserva=extintor).select_related(*relacionados))
    validos = [m for m in envios if m.status != 'cancelado']

    return JsonResponse({
        'success': True,
        'extintor': {**_extintor_resumo(extintor), 'ativo': extintor.ativo},
        'resumo': {
            'envios': len(validos),
            'dias_fora': sum(_manutencao_json(m)['dias_fora'] for m in validos),
            'coberturas': len([m for m in coberturas if m.status != 'cancelado']),
            'em_manutencao': any(m.status == 'em_manutencao' for m in envios),
        },
        'envios': [_manutencao_json(m) for m in envios],
        'coberturas': [_manutencao_json(m) for m in coberturas],
    })


@login_required
@somente_master
@require_http_methods(['POST'])
def enviar_api(request):
    """Passos 1 e 2: registra o envio e coloca a reserva escolhida no local do extintor."""
    try:
        data = _ler_json(request)
        ocupados = ManutencaoExtintor.ids_ocupados()

        extintor = Extintor.objects.filter(id=data.get('extintor'), ativo=True).first()
        if not extintor:
            return _erro('Extintor não encontrado ou desativado', status=404)
        if extintor.id in ocupados:
            return _erro(f'{extintor.codigo} já está em manutenção ou cobrindo outro local')

        reserva = None
        if data.get('reserva'):
            reserva = Extintor.objects.filter(id=data['reserva'], ativo=True, reserva=True).first()
            if not reserva:
                return _erro('Reserva não encontrada ou não marcada como reserva', status=404)
            if reserva.id == extintor.id or reserva.id in ocupados:
                return _erro(f'{reserva.codigo} não está disponível')

        empresa = None
        if data.get('empresa'):
            empresa = EmpresaManutencao.objects.filter(id=data['empresa']).first()
            if not empresa:
                return _erro('Empresa não encontrada', status=404)

        motivos = dict(ManutencaoExtintor.MOTIVO_CHOICES)
        if data.get('motivo') not in motivos:
            raise ValueError('Informe o motivo do envio')
        data_envio = _data(data.get('data_envio'), 'data de envio')
        if data_envio > timezone.localdate():
            raise ValueError('A data de envio não pode ser no futuro')

        with transaction.atomic():
            m = ManutencaoExtintor.objects.create(
                extintor=extintor, reserva=reserva, motivo=data['motivo'], empresa=empresa,
                localizacao_original=extintor.localizacao,
                localizacao_reserva_anterior=reserva.localizacao if reserva else None,
                data_envio=data_envio,
                observacao_envio=(data.get('observacao') or '').strip() or None,
                enviado_por=request.user,
            )
            _registrar_historico(
                'enviado_manutencao',
                f'Manutenção #{m.id} ({m.get_motivo_display()}) saiu de {m.localizacao_original}'
                + (f' para {m.empresa}' if m.empresa else '')
                + (f'; reserva no local: {reserva.codigo}' if reserva else '; local ficou sem reserva'),
                request.user, extintor=extintor,
            )
            extintor.localizacao = LOCAL_MANUTENCAO
            extintor.save()

            if reserva:
                _registrar_historico(
                    'reserva_alocada',
                    f'Manutenção #{m.id}: saiu de {reserva.localizacao} para cobrir {extintor.codigo} '
                    f'em {m.localizacao_original}',
                    request.user, extintor=reserva,
                )
                reserva.localizacao = m.localizacao_original
                reserva.save()

        return JsonResponse({'success': True, 'message': f'{extintor.codigo} enviado para manutenção',
                             'manutencao': _manutencao_json(m)})
    except ValueError as e:
        return _erro(str(e))


@login_required
@somente_master
@require_http_methods(['POST'])
def empresa_create_api(request):
    """Cadastra a empresa pelo próprio modal de envio. Se já existir (sem diferenciar maiúsculas), reaproveita."""
    try:
        nome = ' '.join((_ler_json(request).get('nome') or '').split())
        if not nome:
            raise ValueError('Informe o nome da empresa')
        if len(nome) > 150:
            raise ValueError('Nome muito longo (máximo 150 caracteres)')
        empresa = EmpresaManutencao.objects.filter(nome__iexact=nome).first()
        criada = empresa is None
        if criada:
            empresa = EmpresaManutencao.objects.create(nome=nome)
        return JsonResponse({
            'success': True,
            'message': 'Empresa cadastrada' if criada else 'Empresa já cadastrada, selecionada',
            'empresa': {'id': empresa.id, 'nome': empresa.nome},
        })
    except ValueError as e:
        return _erro(str(e))


@login_required
@somente_master
@require_http_methods(['GET'])
def manutencao_api(request, id):
    m = ManutencaoExtintor.objects.select_related('extintor', 'reserva').filter(id=id).first()
    if not m:
        return _erro('Registro não encontrado', status=404)
    return JsonResponse({'success': True, 'manutencao': _manutencao_json(m)})


@login_required
@somente_master
@require_http_methods(['POST'])
def receber_api(request, id):
    """Passo 3: recebimento. Repor = volta tudo ao lugar; não repor = o recebido vira reserva e a
    reserva fica no local como posto fixo."""
    try:
        data = _ler_json(request)
        with transaction.atomic():
            # of=('self',): o PostgreSQL não trava o lado opcional do join (reserva pode ser nula)
            m = (ManutencaoExtintor.objects.select_for_update(of=('self',))
                 .select_related('extintor', 'reserva').filter(id=id).first())
            if not m:
                return _erro('Registro não encontrado', status=404)
            if m.status != 'em_manutencao':
                return _erro('Este envio já foi encerrado')

            if data.get('repor') not in (True, False):
                raise ValueError('Informe se o extintor volta para o local anterior')
            repor = data['repor']
            data_recebimento = _data(data.get('data_recebimento'), 'data de recebimento')
            if data_recebimento < m.data_envio:
                raise ValueError('A data de recebimento não pode ser antes do envio')
            if data_recebimento > timezone.localdate():
                raise ValueError('A data de recebimento não pode ser no futuro')

            extintor, reserva = m.extintor, m.reserva
            alteracoes = []
            try:
                recarga = primeiro_dia_mes(data.get('proxima_recarga')) if data.get('proxima_recarga') else extintor.proxima_recarga
            except (ValueError, TypeError):
                raise ValueError('Próxima recarga inválida')
            if recarga != extintor.proxima_recarga:
                alteracoes.append(f'Próxima recarga: {_mes_ano(extintor.proxima_recarga) or "-"} → {_mes_ano(recarga)}')
                extintor.proxima_recarga = recarga
            teste = data.get('teste_hidrostatico_ano')
            if teste not in (None, ''):
                try:
                    teste = int(teste)
                except (ValueError, TypeError):
                    raise ValueError('Ano do teste hidrostático inválido')
                if teste != extintor.teste_hidrostatico_ano:
                    alteracoes.append(f'Teste hidrostático: {extintor.teste_hidrostatico_ano or "-"} → {teste}')
                    extintor.teste_hidrostatico_ano = teste
            cilindro = (str(data.get('numero_cilindro') or '')).strip()
            if cilindro and cilindro != (extintor.numero_cilindro or ''):
                alteracoes.append(f'Nº do cilindro: {extintor.numero_cilindro or "-"} → {cilindro}')
                extintor.numero_cilindro = cilindro

            m.status = 'recebido'
            m.data_recebimento = data_recebimento
            m.observacao_recebimento = (data.get('observacao') or '').strip() or None
            m.recebido_por = request.user
            m.reposto = repor
            m.save()

            local_reservas = m.localizacao_reserva_anterior or LOCAL_RESERVA
            if repor:
                extintor.localizacao = m.localizacao_original
                destino = f'reposto em {m.localizacao_original}'
            else:
                extintor.localizacao = local_reservas
                extintor.reserva = True
                destino = f'passou a ser reserva ({local_reservas})'
            extintor.save()
            _registrar_historico(
                'recebido_manutencao',
                f'Manutenção #{m.id}: {destino}' + (f'; {"; ".join(alteracoes)}' if alteracoes else ''),
                request.user, extintor=extintor,
            )

            if reserva:
                if repor:
                    reserva.localizacao = local_reservas
                    descricao = f'Manutenção #{m.id}: {extintor.codigo} foi reposto; voltou para {local_reservas}'
                else:
                    reserva.reserva = False
                    descricao = (f'Manutenção #{m.id}: permanece em {m.localizacao_original} '
                                 f'no lugar de {extintor.codigo} e passou a ser posto fixo')
                reserva.save()
                _registrar_historico('reserva_liberada', descricao, request.user, extintor=reserva)

        return JsonResponse({'success': True, 'message': f'{extintor.codigo} recebido', 'manutencao': _manutencao_json(m)})
    except ValueError as e:
        return _erro(str(e))


@login_required
@somente_master
@require_http_methods(['POST'])
def cancelar_api(request, id):
    """Desfaz as trocas de local de um envio registrado por engano. O registro fica como cancelado."""
    try:
        data = _ler_json(request)
        motivo = (data.get('motivo') or '').strip()
        if not motivo:
            raise ValueError('Informe o motivo do cancelamento')
        with transaction.atomic():
            m = (ManutencaoExtintor.objects.select_for_update(of=('self',))
                 .select_related('extintor', 'reserva').filter(id=id).first())
            if not m:
                return _erro('Registro não encontrado', status=404)
            if m.status != 'em_manutencao':
                return _erro('Só é possível cancelar um envio em manutenção')

            m.status = 'cancelado'
            m.data_cancelamento = timezone.now()
            m.motivo_cancelamento = motivo
            m.cancelado_por = request.user
            m.save()

            m.extintor.localizacao = m.localizacao_original
            m.extintor.save()
            _registrar_historico(
                'manutencao_cancelada', f'Manutenção #{m.id} cancelada: {motivo}', request.user, extintor=m.extintor,
            )
            if m.reserva:
                m.reserva.localizacao = m.localizacao_reserva_anterior or LOCAL_RESERVA
                m.reserva.save()
                _registrar_historico(
                    'reserva_liberada', f'Manutenção #{m.id} cancelada: voltou para {m.reserva.localizacao}',
                    request.user, extintor=m.reserva,
                )
        return JsonResponse({'success': True, 'message': 'Envio cancelado', 'manutencao': _manutencao_json(m)})
    except ValueError as e:
        return _erro(str(e))
