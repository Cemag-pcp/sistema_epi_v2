import { api, esc, setLoading, toastErro, abrirHistorico, ToastBottomEnd, DATATABLE_LANGUAGE } from './utils.js';

const manutencoes = JSON.parse(document.getElementById('dados-manutencoes').textContent);
const disponiveis = JSON.parse(document.getElementById('dados-disponiveis').textContent);
const porId = Object.fromEntries(manutencoes.map(m => [m.id, m]));

// Depois de enviar/receber/cancelar a página recarrega (os extintores disponíveis e os
// indicadores mudam); a mensagem de sucesso sobrevive ao reload por aqui
const CHAVE_AVISO = 'incendio-manutencao-aviso';
function recarregarComAviso(mensagem) {
    try { sessionStorage.setItem(CHAVE_AVISO, mensagem); } catch (e) { /* sem storage: só recarrega */ }
    window.location.reload();
}
try {
    const aviso = sessionStorage.getItem(CHAVE_AVISO);
    if (aviso) {
        sessionStorage.removeItem(CHAVE_AVISO);
        ToastBottomEnd.fire({ icon: 'success', title: aviso });
    }
} catch (e) { /* sem storage */ }

const STATUS_CLASSE = { em_manutencao: 'bg-info text-dark', recebido: 'status-approved', cancelado: 'status-declined' };

function badgeStatus(m) {
    return `<span class="badge rounded-pill ${STATUS_CLASSE[m.status]}">${esc(m.status_display)}</span>`;
}

function textoOu(type, texto, html) {
    return type === 'display' ? html : texto;
}

// ---- Tabela ---------------------------------------------------------------------------------

const tabela = $('#tabela-manutencoes').DataTable({
    language: DATATABLE_LANGUAGE,
    data: manutencoes,
    rowId: row => `manutencao-${row.id}`,
    order: [[0, 'desc']],
    dom: 'rtip',
    pageLength: 25,
    columns: [
        { data: 'data_envio_iso', render: (d, type, row) => type === 'display' ? esc(row.data_envio) : d },
        {
            data: 'extintor',
            render: (d, type) => textoOu(type, `${d.codigo} ${d.agente}`,
                `<strong>${esc(d.codigo)}</strong><div class="small text-muted">${esc(d.agente)} ${esc(d.capacidade_kg)} kg</div>`),
        },
        { data: 'localizacao_original', render: (d, type) => textoOu(type, d, esc(d)) },
        {
            data: 'reserva',
            render: (d, type) => textoOu(type, d ? d.codigo : 'sem reserva',
                d ? `<strong>${esc(d.codigo)}</strong>` : '<span class="badge bg-danger">Sem reserva</span>'),
        },
        { data: 'motivo_display', render: (d, type) => textoOu(type, d, esc(d)) },
        { data: 'empresa', render: (d, type) => textoOu(type, d, d ? esc(d) : '<span class="text-muted">-</span>') },
        {
            data: 'data_recebimento',
            render: (d, type, row) => {
                if (type !== 'display') return d;
                if (row.status === 'em_manutencao') return `<span class="text-muted">há ${row.dias_fora} dia${row.dias_fora === 1 ? '' : 's'}</span>`;
                if (!d) return '<span class="text-muted">-</span>';
                return `${esc(d)}<div class="small text-muted">${row.reposto ? 'Reposto no local' : 'Virou reserva'}</div>`;
            },
        },
        { data: 'status_display', render: (d, type, row) => textoOu(type, d, badgeStatus(row)) },
        {
            data: null, orderable: false, searchable: false,
            render: (d, type, row) => `
                <div class="dropdown">
                    <button class="btn btn-link btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="bi bi-three-dots" style="color: black"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        ${row.status === 'em_manutencao' ? `
                        <li><a class="dropdown-item acao" data-acao="receber" data-id="${row.id}" href="#">
                            <i class="bi bi-box-arrow-in-down me-2"></i>Registrar recebimento</a></li>` : ''}
                        <li><a class="dropdown-item acao" data-acao="ver" data-id="${row.id}" href="#">
                            <i class="bi bi-eye me-2"></i>Detalhes</a></li>
                        <li><a class="dropdown-item" href="/incendio/manutencao/historico/?extintor=${row.extintor.id}">
                            <i class="bi bi-tools me-2"></i>Manutenções deste extintor</a></li>
                        <li><a class="dropdown-item acao" data-acao="historico" data-id="${row.id}" href="#">
                            <i class="bi bi-clock-history me-2"></i>Histórico do extintor</a></li>
                        ${row.status === 'em_manutencao' ? `
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item acao" data-acao="cancelar" data-id="${row.id}" href="#" style="color: #dc2626;">
                            <i class="bi bi-x-circle me-2"></i>Cancelar envio</a></li>` : ''}
                    </ul>
                </div>`,
        },
    ],
});

const filtroStatus = document.getElementById('filtro-status');
const aplicarStatus = () => tabela.column(7).search(filtroStatus.value ? `^${filtroStatus.value}$` : '', true, false).draw();
filtroStatus.addEventListener('change', aplicarStatus);
document.getElementById('filtro-texto').addEventListener('input', e => tabela.search(e.target.value).draw());
aplicarStatus();

// ---- Envio: passos 1 e 2 --------------------------------------------------------------------

const modalEnvio = new bootstrap.Modal(document.getElementById('modal-envio'));
const selectExtintor = $('#envio-extintor');
const passo1 = document.getElementById('envio-passo-1');
const passo2 = document.getElementById('envio-passo-2');
const btnVoltar = document.getElementById('envio-voltar');
const btnProximo = document.getElementById('envio-proximo');
const btnConfirmar = document.getElementById('envio-confirmar');
const listaReservas = document.getElementById('lista-reservas');

disponiveis
    .filter(e => !e.reserva)
    .concat(disponiveis.filter(e => e.reserva))
    .forEach(e => {
        const texto = `${e.codigo} – ${e.localizacao} (${e.agente} ${e.capacidade_kg} kg)${e.reserva ? ' • reserva' : ''}`;
        selectExtintor.append(new Option(texto, e.id));
    });
selectExtintor.select2({ dropdownParent: $('#modal-envio'), width: '100%', theme: 'bootstrap-5' });

// ---- Empresa: select com cadastro rápido ----------------------------------------------------

const selectEmpresa = $('#envio-empresa');
selectEmpresa.select2({
    dropdownParent: $('#modal-envio'), width: '100%', theme: 'bootstrap-5',
    placeholder: 'Selecione a empresa', allowClear: true,
});

const grupoNovaEmpresa = document.getElementById('nova-empresa-grupo');
const inputNovaEmpresa = document.getElementById('nova-empresa-nome');
const btnSalvarEmpresa = document.getElementById('nova-empresa-salvar');

function mostrarNovaEmpresa(mostrar) {
    grupoNovaEmpresa.classList.toggle('d-none', !mostrar);
    inputNovaEmpresa.value = '';
    if (mostrar) inputNovaEmpresa.focus();
}

async function salvarEmpresa() {
    const nome = inputNovaEmpresa.value.trim();
    if (!nome) return ToastBottomEnd.fire({ icon: 'warning', title: 'Informe o nome da empresa' });
    setLoading(btnSalvarEmpresa, true);
    try {
        const { empresa, message } = await api('/incendio/api/manutencoes/empresas/', 'POST', { nome });
        if (!selectEmpresa.find(`option[value="${empresa.id}"]`).length) {
            selectEmpresa.append(new Option(empresa.nome, empresa.id));
        }
        selectEmpresa.val(String(empresa.id)).trigger('change');
        mostrarNovaEmpresa(false);
        ToastBottomEnd.fire({ icon: 'success', title: message });
    } catch (error) {
        toastErro(error);
    } finally {
        setLoading(btnSalvarEmpresa, false);
    }
}

document.getElementById('nova-empresa-abrir').addEventListener('click', () => mostrarNovaEmpresa(grupoNovaEmpresa.classList.contains('d-none')));
document.getElementById('nova-empresa-cancelar').addEventListener('click', () => mostrarNovaEmpresa(false));
btnSalvarEmpresa.addEventListener('click', salvarEmpresa);
inputNovaEmpresa.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        salvarEmpresa();
    }
});

function extintorEscolhido() {
    return disponiveis.find(e => String(e.id) === String(selectExtintor.val()));
}

selectExtintor.on('change', () => {
    const e = extintorEscolhido();
    document.getElementById('envio-extintor-info').textContent = e
        ? `Cilindro ${e.numero_cilindro || '-'} • próxima recarga ${e.proxima_recarga ? e.proxima_recarga.split('-').reverse().join('/') : '-'} • teste hidrostático ${e.teste_hidrostatico_ano || '-'}`
        : '';
});

function marcarPasso(numero) {
    document.querySelectorAll('#modal-envio .fluxo-passo').forEach(p => {
        const n = parseInt(p.dataset.passo);
        p.classList.toggle('ativo', n === numero);
        p.classList.toggle('feito', n < numero);
    });
}

function mostrarPasso(numero) {
    passo1.classList.toggle('d-none', numero !== 1);
    passo2.classList.toggle('d-none', numero !== 2);
    btnVoltar.classList.toggle('d-none', numero !== 2);
    btnProximo.classList.toggle('d-none', numero !== 1);
    btnConfirmar.classList.toggle('d-none', numero !== 2);
    btnConfirmar.classList.toggle('d-flex', numero === 2);
    marcarPasso(numero);
}

// 2 = mesmo tipo e capacidade, 1 = mesmo tipo, 0 = tipo diferente
function compatibilidade(reserva, extintor) {
    if (reserva.agente !== extintor.agente) return 0;
    return reserva.capacidade_kg === extintor.capacidade_kg ? 2 : 1;
}

const SELO_COMPATIBILIDADE = [
    '<span class="badge bg-warning text-dark ms-1">Tipo diferente</span>',
    '<span class="badge bg-info text-dark ms-1">Mesmo tipo, outra capacidade</span>',
    '<span class="badge bg-success ms-1">Mesmo tipo e capacidade</span>',
];

function renderReservas(extintor) {
    // As mais compatíveis primeiro
    const reservas = disponiveis
        .filter(e => e.reserva && e.id !== extintor.id)
        .sort((a, b) => compatibilidade(b, extintor) - compatibilidade(a, extintor) || a.codigo.localeCompare(b.codigo));

    const opcoes = reservas.map((r, i) => `
        <label class="card opcao-reserva">
            <div class="card-body py-2 d-flex align-items-center gap-3">
                <input class="form-check-input mt-0" type="radio" name="reserva" value="${r.id}" ${i === 0 && compatibilidade(r, extintor) ? 'checked' : ''}>
                <div class="flex-grow-1">
                    <strong>${esc(r.codigo)}</strong> – ${esc(r.agente)} ${esc(r.capacidade_kg)} kg
                    ${SELO_COMPATIBILIDADE[compatibilidade(r, extintor)]}
                    <div class="small text-muted">Cilindro ${esc(r.numero_cilindro || '-')} • hoje em ${esc(r.localizacao)}</div>
                </div>
            </div>
        </label>`).join('');

    listaReservas.innerHTML = (opcoes || '<div class="alert alert-warning mb-0">Nenhuma reserva disponível no momento.</div>') + `
        <label class="card opcao-reserva border-danger-subtle">
            <div class="card-body py-2 d-flex align-items-center gap-3">
                <input class="form-check-input mt-0" type="radio" name="reserva" value="" ${opcoes && compatibilidade(reservas[0], extintor) ? '' : 'checked'}>
                <div>
                    <strong class="text-danger">Enviar sem reserva</strong>
                    <div class="small text-muted">O local fica sem extintor até o recebimento.</div>
                </div>
            </div>
        </label>`;
}

document.getElementById('abrir-envio').addEventListener('click', () => {
    selectExtintor.val('').trigger('change');
    document.getElementById('envio-motivo').value = '';
    selectEmpresa.val('').trigger('change');
    mostrarNovaEmpresa(false);
    document.getElementById('envio-observacao').value = '';
    document.getElementById('envio-data').value = document.getElementById('envio-data').max;
    mostrarPasso(1);
    modalEnvio.show();
});

btnProximo.addEventListener('click', () => {
    const extintor = extintorEscolhido();
    if (!extintor) return ToastBottomEnd.fire({ icon: 'warning', title: 'Escolha o extintor' });
    if (!document.getElementById('envio-motivo').value) return ToastBottomEnd.fire({ icon: 'warning', title: 'Informe o motivo' });
    if (!document.getElementById('envio-data').value) return ToastBottomEnd.fire({ icon: 'warning', title: 'Informe a data de envio' });
    document.getElementById('envio-local').textContent = extintor.localizacao;
    document.getElementById('envio-codigo').textContent = extintor.codigo;
    renderReservas(extintor);
    mostrarPasso(2);
});

btnVoltar.addEventListener('click', () => mostrarPasso(1));

btnConfirmar.addEventListener('click', async () => {
    const escolhida = listaReservas.querySelector('input[name="reserva"]:checked');
    if (!escolhida) return ToastBottomEnd.fire({ icon: 'warning', title: 'Escolha a reserva ou "Enviar sem reserva"' });
    setLoading(btnConfirmar, true);
    try {
        const data = await api('/incendio/api/manutencoes/', 'POST', {
            extintor: parseInt(selectExtintor.val()),
            reserva: escolhida.value ? parseInt(escolhida.value) : null,
            motivo: document.getElementById('envio-motivo').value,
            empresa: selectEmpresa.val() ? parseInt(selectEmpresa.val()) : null,
            data_envio: document.getElementById('envio-data').value,
            observacao: document.getElementById('envio-observacao').value,
        });
        modalEnvio.hide();
        recarregarComAviso(data.message);
    } catch (error) {
        toastErro(error);
        setLoading(btnConfirmar, false);
    }
});

// ---- Recebimento: passo 3 -------------------------------------------------------------------

const modalRecebimento = new bootstrap.Modal(document.getElementById('modal-recebimento'));
const btnReceber = document.getElementById('recebimento-confirmar');
let recebendo = null;

function abrirRecebimento(m) {
    recebendo = m;
    const e = m.extintor;
    document.getElementById('recebimento-titulo').textContent = `Registrar recebimento – ${e.codigo}`;
    document.getElementById('recebimento-subtitulo').textContent =
        `${m.motivo_display}${m.empresa ? ` • ${m.empresa}` : ''} • enviado em ${m.data_envio} (há ${m.dias_fora} dias)`;
    const dataInput = document.getElementById('recebimento-data');
    dataInput.min = m.data_envio_iso;
    dataInput.value = dataInput.max;
    document.getElementById('recebimento-recarga').value = e.proxima_recarga;
    document.getElementById('recebimento-teste').value = e.teste_hidrostatico_ano;
    document.getElementById('recebimento-cilindro').value = e.numero_cilindro;
    document.getElementById('recebimento-observacao').value = '';
    document.querySelectorAll('input[name="repor"]').forEach(r => { r.checked = false; });

    const reserva = m.reserva;
    document.getElementById('repor-sim-texto').textContent = reserva
        ? `${e.codigo} volta para ${m.localizacao_original} e a reserva ${reserva.codigo} volta para o estoque de reservas.`
        : `${e.codigo} volta para ${m.localizacao_original}.`;
    document.getElementById('repor-nao-texto').textContent = reserva
        ? `${reserva.codigo} continua em ${m.localizacao_original} como posto fixo e ${e.codigo} passa a ser reserva.`
        : `${e.codigo} passa a ser reserva e ${m.localizacao_original} continua sem extintor.`;
    modalRecebimento.show();
}

btnReceber.addEventListener('click', async () => {
    const repor = document.querySelector('input[name="repor"]:checked');
    if (!repor) return ToastBottomEnd.fire({ icon: 'warning', title: 'Responda se o extintor volta para o local anterior' });
    setLoading(btnReceber, true);
    try {
        const data = await api(`/incendio/api/manutencoes/${recebendo.id}/receber/`, 'POST', {
            repor: repor.value === 'sim',
            data_recebimento: document.getElementById('recebimento-data').value,
            proxima_recarga: document.getElementById('recebimento-recarga').value,
            teste_hidrostatico_ano: document.getElementById('recebimento-teste').value,
            numero_cilindro: document.getElementById('recebimento-cilindro').value,
            observacao: document.getElementById('recebimento-observacao').value,
        });
        modalRecebimento.hide();
        recarregarComAviso(data.message);
    } catch (error) {
        toastErro(error);
        setLoading(btnReceber, false);
    }
});

// ---- Detalhes -------------------------------------------------------------------------------

const modalDetalhe = new bootstrap.Modal(document.getElementById('modal-detalhe'));

function abrirDetalhe(m) {
    document.getElementById('detalhe-titulo').textContent = `Manutenção #${m.id} – ${m.extintor.codigo}`;
    document.getElementById('detalhe-subtitulo').textContent = `${m.localizacao_original} • ${m.status_display}`;
    document.getElementById('detalhe-corpo').innerHTML = `
        <ul class="linha-tempo">
            ${m.etapas.map(etapa => `
                <li>
                    <div class="d-flex justify-content-between flex-wrap gap-2">
                        <strong>${esc(etapa.titulo)}</strong>
                        <small class="text-muted">${esc(etapa.data)} • ${esc(etapa.usuario)}</small>
                    </div>
                    ${etapa.descricao ? `<div class="small text-muted">${esc(etapa.descricao)}</div>` : ''}
                </li>`).join('')}
            ${m.status === 'em_manutencao' ? `
                <li><strong class="text-muted">Aguardando recebimento</strong>
                    <div class="small text-muted">Fora há ${m.dias_fora} dia${m.dias_fora === 1 ? '' : 's'}</div></li>` : ''}
        </ul>`;
    modalDetalhe.show();
}

// ---- Cancelar -------------------------------------------------------------------------------

const modalCancelar = new bootstrap.Modal(document.getElementById('modal-cancelar'));
const btnCancelar = document.getElementById('cancelar-confirmar');
let cancelando = null;

btnCancelar.addEventListener('click', async () => {
    setLoading(btnCancelar, true);
    try {
        const data = await api(`/incendio/api/manutencoes/${cancelando.id}/cancelar/`, 'POST', {
            motivo: document.getElementById('cancelar-motivo').value,
        });
        modalCancelar.hide();
        recarregarComAviso(data.message);
    } catch (error) {
        toastErro(error);
        setLoading(btnCancelar, false);
    }
});

// ---- Menu de ações --------------------------------------------------------------------------

document.addEventListener('click', event => {
    const link = event.target.closest('.acao');
    if (!link) return;
    event.preventDefault();
    const m = porId[link.dataset.id];
    if (!m) return;

    if (link.dataset.acao === 'receber') {
        abrirRecebimento(m);
    } else if (link.dataset.acao === 'ver') {
        abrirDetalhe(m);
    } else if (link.dataset.acao === 'historico') {
        abrirHistorico('extintor', m.extintor.id, `${m.extintor.codigo} – ${m.localizacao_original}`);
    } else if (link.dataset.acao === 'cancelar') {
        cancelando = m;
        const reserva = m.reserva ? ` e ${m.reserva.codigo} volta para ${m.reserva.localizacao === m.localizacao_original ? 'as reservas' : m.reserva.localizacao}` : '';
        document.getElementById('cancelar-descricao').textContent =
            `${m.extintor.codigo} volta para ${m.localizacao_original}${reserva}.`;
        document.getElementById('cancelar-motivo').value = '';
        modalCancelar.show();
    }
});
