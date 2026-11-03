import { api, esc, abrirHistorico, DATATABLE_LANGUAGE } from './utils.js';

const extintores = JSON.parse(document.getElementById('dados-extintores').textContent);
const abrirAoCarregar = JSON.parse(document.getElementById('abrir-extintor').textContent);

const STATUS_CLASSE = { em_manutencao: 'bg-info text-dark', recebido: 'status-approved', cancelado: 'status-declined' };

function textoOu(type, texto, html) {
    return type === 'display' ? html : texto;
}

function plural(n, singular, pluralTexto) {
    return `${n} ${n === 1 ? singular : pluralTexto}`;
}

// ---- Tabela ---------------------------------------------------------------------------------

const tabelaEl = document.getElementById('tabela-historico');
const tabela = $(tabelaEl).DataTable({
    language: DATATABLE_LANGUAGE,
    data: extintores,
    rowId: row => `extintor-${row.id}`,
    order: [[5, 'desc'], [0, 'asc']],
    dom: 'rtip',
    pageLength: 25,
    columns: [
        {
            data: 'codigo',
            render: (d, type, row) => textoOu(type, `${d} ${row.numero_cilindro} ${row.reserva ? 'reserva' : ''}`,
                `<strong>${esc(d)}</strong>`
                + (row.reserva ? ' <span class="badge rounded-pill status-peding ms-1">Reserva</span>' : '')
                + (!row.ativo ? ' <span class="badge rounded-pill status-declined ms-1">Desativado</span>' : '')
                + `<div class="small text-muted">Cilindro ${esc(row.numero_cilindro || '-')}</div>`),
        },
        { data: 'localizacao', render: (d, type) => textoOu(type, d, esc(d)) },
        { data: 'agente', render: (d, type, row) => textoOu(type, d, `${esc(d)} ${esc(row.capacidade_kg)} kg`) },
        {
            data: 'total_envios', className: 'text-center',
            render: (d, type) => textoOu(type, d, d ? `<span class="badge bg-dark">${d}</span>` : '<span class="text-muted">0</span>'),
        },
        {
            // Vezes em que este extintor (como reserva) ficou no lugar de outro
            data: 'total_coberturas', className: 'text-center',
            render: (d, type) => textoOu(type, d, d ? `<span class="badge status-peding">${d}</span>` : '<span class="text-muted">0</span>'),
        },
        {
            data: 'ultimo_envio_iso',
            render: (d, type, row) => textoOu(type, d,
                d ? `${esc(row.ultimo_envio)}<div class="small text-muted">${esc(row.ultimo_motivo)}</div>` : '<span class="text-muted">Nunca</span>'),
        },
        {
            data: 'em_manutencao',
            render: (d, type) => textoOu(type, d ? 'Em manutenção' : 'No local',
                d ? '<span class="badge rounded-pill bg-info text-dark">Em manutenção</span>'
                  : '<span class="badge rounded-pill status-approved">No local</span>'),
        },
        {
            data: null, orderable: false, searchable: false, className: 'text-end',
            render: (d, type, row) => `<button class="btn btn-sm btn-white ver-historico" data-id="${row.id}">
                <i class="bi bi-clock-history me-1"></i>Ver histórico</button>`,
        },
    ],
});

const filtroTipo = document.getElementById('filtro-tipo');
const filtroComManutencao = document.getElementById('filtro-com-manutencao');

$.fn.dataTable.ext.search.push((settings, data, dataIndex) => {
    if (settings.nTable !== tabelaEl) return true;
    const row = tabela.row(dataIndex).data();
    if (filtroTipo.value && row.agente !== filtroTipo.value) return false;
    if (filtroComManutencao.checked && !row.total_envios && !row.total_coberturas && !row.em_manutencao) return false;
    return true;
});

document.getElementById('filtro-texto').addEventListener('input', e => tabela.search(e.target.value).draw());
filtroTipo.addEventListener('change', () => tabela.draw());
filtroComManutencao.addEventListener('change', () => tabela.draw());
tabela.draw();

// ---- Modal com o histórico do extintor ------------------------------------------------------

const modal = new bootstrap.Modal(document.getElementById('modal-historico-manutencao'));
const corpo = document.getElementById('hm-corpo');
let extintorAberto = null;

function linhaTempo(m) {
    return `
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
                    <div class="small text-muted">Fora há ${plural(m.dias_fora, 'dia', 'dias')}</div></li>` : ''}
        </ul>`;
}

function cardManutencao(m) {
    return `
        <div class="card mb-3">
            <div class="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    <strong>Manutenção #${m.id}</strong> • ${esc(m.motivo_display)}${m.empresa ? ` • ${esc(m.empresa)}` : ''}
                    <div class="small text-muted">
                        ${esc(m.data_envio)}${m.data_recebimento ? ` → ${esc(m.data_recebimento)}` : ''}
                        ${m.status !== 'cancelado' ? ` • ${plural(m.dias_fora, 'dia', 'dias')} fora` : ''}
                    </div>
                </div>
                <span class="badge rounded-pill ${STATUS_CLASSE[m.status]}">${esc(m.status_display)}</span>
            </div>
            <div class="card-body">${linhaTempo(m)}</div>
        </div>`;
}

function cardCobertura(m) {
    return `
        <li class="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
                Cobriu <strong>${esc(m.extintor.codigo)}</strong> em ${esc(m.localizacao_original)}
                <div class="small text-muted">
                    ${esc(m.data_envio)}${m.data_recebimento ? ` → ${esc(m.data_recebimento)}` : ' → em andamento'}
                    ${m.status === 'recebido' && !m.reposto ? ' • ficou no local como posto fixo' : ''}
                </div>
            </div>
            <span class="badge rounded-pill ${STATUS_CLASSE[m.status]}">${esc(m.status_display)}</span>
        </li>`;
}

function indicador(rotulo, valor, classe = '') {
    return `
        <div class="col-6 col-md-3">
            <div class="card kpi-card h-100"><div class="card-body py-2">
                <div class="kpi-label">${rotulo}</div><div class="kpi-valor ${classe}">${valor}</div>
            </div></div>
        </div>`;
}

async function abrir(id) {
    extintorAberto = id;
    corpo.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    modal.show();
    try {
        const { extintor, resumo, envios, coberturas } = await api(`/incendio/api/manutencoes/extintor/${id}/`);
        document.getElementById('hm-titulo').textContent = `Histórico de manutenções – ${extintor.codigo}`;
        document.getElementById('hm-subtitulo').textContent =
            `${extintor.agente} ${extintor.capacidade_kg} kg • cilindro ${extintor.numero_cilindro || '-'} • hoje em ${extintor.localizacao}`;

        corpo.innerHTML = `
            <div class="row g-2 mb-4">
                ${indicador('Envios', resumo.envios)}
                ${indicador('Dias fora (total)', resumo.dias_fora)}
                ${indicador('Coberturas como reserva', resumo.coberturas)}
                ${indicador('Situação', resumo.em_manutencao ? 'Fora' : 'No local', resumo.em_manutencao ? 'text-info' : 'text-success')}
            </div>
            <h6 class="fw-bold">Envios para manutenção</h6>
            ${envios.length ? envios.map(cardManutencao).join('') : '<p class="text-muted">Este extintor ainda não foi enviado para manutenção.</p>'}
            ${coberturas.length ? `
                <h6 class="fw-bold mt-4">Coberturas como reserva</h6>
                <ul class="list-group">${coberturas.map(cardCobertura).join('')}</ul>` : ''}`;
    } catch (error) {
        corpo.innerHTML = `<p class="text-danger text-center py-4 mb-0">${esc(error.message)}</p>`;
    }
}

tabelaEl.addEventListener('click', event => {
    const botao = event.target.closest('.ver-historico');
    if (botao) abrir(botao.dataset.id);
});

// Clicar na linha também abre (menos no botão, que já trata o clique)
$(tabelaEl).on('click', 'tbody tr', function (event) {
    if (event.target.closest('.ver-historico')) return;
    const row = tabela.row(this).data();
    if (row) abrir(row.id);
});

document.getElementById('hm-historico-geral').addEventListener('click', () => {
    const e = extintores.find(x => String(x.id) === String(extintorAberto));
    modal.hide();
    abrirHistorico('extintor', extintorAberto, e ? `${e.codigo} – ${e.localizacao}` : '');
});

// Link vindo da tela de Manutenção: /incendio/manutencao/historico/?extintor=<id>
if (abrirAoCarregar) abrir(abrirAoCarregar);
