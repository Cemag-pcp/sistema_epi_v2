import {
    api, esc, setLoading, toastErro, badgeResultado, badgeStatus, abrirHistorico, ToastBottomEnd, DATATABLE_LANGUAGE,
} from './utils.js';

const tabelaEl = document.getElementById('tabela-inspecoes');
const tipo = tabelaEl.dataset.tipo; // 'extintor' | 'hidrante'
const colunaStatus = tipo === 'extintor' ? 8 : 6;
const colunaAcoes = tipo === 'extintor' ? 9 : 7;

const tabela = $(tabelaEl).DataTable({
    language: DATATABLE_LANGUAGE,
    order: [[0, 'desc']],
    dom: 'rtip',
    pageLength: 25,
    columnDefs: [{ targets: colunaAcoes, orderable: false, searchable: false }],
});

// ---- Filtros --------------------------------------------------------------------------------

const filtroMes = document.getElementById('filtro-mes');

$.fn.dataTable.ext.search.push((settings, data, dataIndex) => {
    if (settings.nTable !== tabelaEl || !filtroMes.value) return true;
    return tabela.row(dataIndex).node().dataset.mes === filtroMes.value;
});

document.getElementById('filtro-texto').addEventListener('input', e => tabela.search(e.target.value).draw());
document.getElementById('filtro-status').addEventListener('change', e => {
    tabela.column(colunaStatus).search(e.target.value ? `^${e.target.value}$` : '', true, false).draw();
});
filtroMes.addEventListener('change', () => tabela.draw());

// ---- Iniciar inspeção -----------------------------------------------------------------------

const modalIniciar = new bootstrap.Modal(document.getElementById('modal-iniciar'));
const selectEquipamento = $('#select-equipamento');
const confirmarIniciar = document.getElementById('confirmar-iniciar');

selectEquipamento.select2({
    dropdownParent: $('#modal-iniciar'),
    width: '100%',
    theme: 'bootstrap-5',
    placeholder: 'Selecione pelo código ou local',
});
selectEquipamento.on('change', () => { confirmarIniciar.disabled = !selectEquipamento.val(); });

document.getElementById('abrir-iniciar').addEventListener('click', () => {
    selectEquipamento.val('').trigger('change');
    modalIniciar.show();
});
confirmarIniciar.addEventListener('click', () => {
    if (selectEquipamento.val()) window.location.href = selectEquipamento.val();
});

// ---- Visualizar -----------------------------------------------------------------------------

const modalDetalhe = new bootstrap.Modal(document.getElementById('modal-detalhe'));
const corpoDetalhe = document.getElementById('detalhe-corpo');

function linhaItem(rotulo, resultado, extra = '') {
    return `
        <li class="list-group-item d-flex justify-content-between align-items-center gap-2">
            <div>${esc(rotulo)}${extra ? `<div class="small text-muted">${extra}</div>` : ''}</div>
            ${badgeResultado(resultado)}
        </li>`;
}

function renderDetalhe(inspecao) {
    let dados;
    let itens;
    if (tipo === 'extintor') {
        dados = `
            <div class="col-6 col-md-3"><div class="text-muted small">Nº cilindro</div>${esc(inspecao.numero_cilindro || '-')}</div>
            <div class="col-6 col-md-3"><div class="text-muted small">Tipo / Cap.</div>${esc(inspecao.agente)} – ${esc(inspecao.capacidade_kg)} kg</div>
            <div class="col-6 col-md-3"><div class="text-muted small">Próx. recarga</div>${esc(inspecao.proxima_recarga || '-')}</div>
            <div class="col-6 col-md-3"><div class="text-muted small">Teste hidrostático</div>${esc(inspecao.teste_hidrostatico_ano || '-')}</div>`;
        itens = inspecao.itens.map(i => linhaItem(i.rotulo, i.resultado)).join('');
    } else {
        dados = `
            <div class="col-12"><div class="text-muted small">Falta equipamento?</div>
                ${inspecao.falta_equipamento
                    ? `<span class="badge bg-danger">Sim</span> ${esc(inspecao.falta_descricao)}`
                    : '<span class="badge bg-success">Não</span>'}
            </div>`;
        itens = linhaItem('Equipamento funciona perfeitamente?', inspecao.funcionamento)
            + inspecao.itens.map(i => linhaItem(
                i.nome, i.resultado,
                i.quantidade_prevista !== null
                    ? `Previsto: ${i.quantidade_prevista} • Encontrado: ${i.quantidade_encontrada ?? '-'}`
                    : '',
            )).join('');
    }

    const fotos = inspecao.fotos.length
        ? `<div class="photo-grid">${inspecao.fotos.map(f => `
                <img src="${esc(f.url)}" alt="${esc(f.nome)}" class="rounded border foto-miniatura" data-url="${esc(f.url)}">`).join('')}
           </div>`
        : '<p class="text-muted small mb-0">Nenhuma foto.</p>';

    corpoDetalhe.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div>Inspetor: <strong>${esc(inspecao.inspetor)}</strong></div>
            ${badgeStatus(inspecao.status, inspecao.status_display)}
        </div>
        <div class="row g-3 mb-3">${dados}</div>
        <h6 class="fw-bold">Checklist</h6>
        <ul class="list-group mb-3">${itens}</ul>
        <h6 class="fw-bold">Observação</h6>
        <p class="mb-3">${inspecao.observacao ? esc(inspecao.observacao) : '<span class="text-muted">-</span>'}</p>
        <h6 class="fw-bold">Fotos</h6>
        ${fotos}`;
}

async function abrirDetalhe(id) {
    corpoDetalhe.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    modalDetalhe.show();
    try {
        const { inspecao } = await api(`/incendio/api/inspecoes/${tipo}/${id}/`);
        document.getElementById('detalhe-titulo').textContent = `Inspeção ${inspecao.codigo} – ${inspecao.data}`;
        document.getElementById('detalhe-subtitulo').textContent = inspecao.localizacao;
        document.getElementById('detalhe-editar').href = inspecao.url_editar;
        renderDetalhe(inspecao);
    } catch (error) {
        corpoDetalhe.innerHTML = `<p class="text-danger text-center py-4 mb-0">${esc(error.message)}</p>`;
    }
}

const modalFoto = new bootstrap.Modal(document.getElementById('modal-foto'));
corpoDetalhe.addEventListener('click', event => {
    const miniatura = event.target.closest('.foto-miniatura');
    if (!miniatura) return;
    document.getElementById('foto-ampliada').src = miniatura.dataset.url;
    modalFoto.show();
});

// ---- Excluir --------------------------------------------------------------------------------

const modalExcluir = new bootstrap.Modal(document.getElementById('modal-excluir'));
const confirmarExcluir = document.getElementById('confirmar-excluir');
let excluirId = null;

confirmarExcluir.addEventListener('click', async () => {
    setLoading(confirmarExcluir, true);
    try {
        const data = await api(`/incendio/api/inspecoes/${tipo}/${excluirId}/`, 'DELETE');
        modalExcluir.hide();
        tabela.row(tabelaEl.querySelector(`tr[data-id="${excluirId}"]`)).remove().draw(false);
        ToastBottomEnd.fire({ icon: 'success', title: data.message });
    } catch (error) {
        toastErro(error);
    } finally {
        setLoading(confirmarExcluir, false);
    }
});

// ---- Menu de ações --------------------------------------------------------------------------

document.addEventListener('click', event => {
    const link = event.target.closest('.acao-inspecao');
    if (!link) return;
    event.preventDefault();
    const { acao, id } = link.dataset;

    if (acao === 'ver') {
        abrirDetalhe(id);
    } else if (acao === 'historico') {
        abrirHistorico(tipo, id, link.dataset.titulo);
    } else if (acao === 'excluir') {
        excluirId = id;
        document.getElementById('excluir-descricao').textContent = link.dataset.descricao;
        modalExcluir.show();
    }
});
