import {
    api, esc, setLoading, toastErro, badgeAtivo, abrirHistorico, ToastBottomEnd, DATATABLE_LANGUAGE,
} from './utils.js';

const extintores = JSON.parse(document.getElementById('dados-extintores').textContent);
const hidrantes = JSON.parse(document.getElementById('dados-hidrantes').textContent);

function menuAcoes(tipo, item) {
    return `
        <div class="dropdown">
            <button class="btn btn-link btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="bi bi-three-dots" style="color: black"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
                <li><a class="dropdown-item acao" data-acao="editar" data-tipo="${tipo}" data-id="${item.id}" href="#">
                    <i class="bi bi-pencil-square me-2"></i>Editar</a></li>
                <li><a class="dropdown-item acao" data-acao="qrcode" data-tipo="${tipo}" data-id="${item.id}" href="#">
                    <i class="bi bi-qr-code me-2"></i>QR Code</a></li>
                <li><a class="dropdown-item acao" data-acao="historico" data-tipo="${tipo}" data-id="${item.id}" href="#">
                    <i class="bi bi-clock-history me-2"></i>Histórico</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item acao" data-acao="status" data-tipo="${tipo}" data-id="${item.id}" href="#"
                       style="color: ${item.ativo ? '#dc2626' : '#16a34a'}">
                    <i class="bi ${item.ativo ? 'bi-toggle-off' : 'bi-toggle-on'} me-2"></i>${item.ativo ? 'Desativar' : 'Ativar'}</a></li>
            </ul>
        </div>`;
}

function textoOuBadge(type, texto, html) {
    return type === 'display' ? html : texto;
}

// ---- Tabelas ------------------------------------------------------------------------------

const tabelaExtintores = $('#tabela-extintores').DataTable({
    language: DATATABLE_LANGUAGE,
    data: extintores,
    rowId: row => `extintor-${row.id}`,
    order: [[0, 'asc']],
    dom: 'rtip',
    pageLength: 25,
    columns: [
        { data: 'codigo', render: (d, type) => textoOuBadge(type, d, `<strong>${esc(d)}</strong>`) },
        { data: 'localizacao', render: (d, type) => textoOuBadge(type, d, esc(d)) },
        { data: 'numero_cilindro', render: (d, type) => textoOuBadge(type, d, d ? esc(d) : '<span class="text-muted">-</span>') },
        { data: 'agente', render: (d, type) => textoOuBadge(type, d, esc(d)) },
        { data: 'capacidade_kg', render: (d, type) => type === 'display' ? `${esc(d)} kg` : parseFloat(d) },
        {
            data: 'proxima_recarga',
            render: (d, type, row) => {
                if (type !== 'display') return d;
                if (!d) return '<span class="text-muted">-</span>';
                return row.recarga_vencida
                    ? `<span class="badge bg-danger" title="Recarga vencida">${esc(row.proxima_recarga_display)}</span>`
                    : esc(row.proxima_recarga_display);
            },
        },
        {
            data: 'teste_hidrostatico_ano',
            render: (d, type, row) => {
                if (type !== 'display') return d;
                if (!d) return '<span class="text-muted">-</span>';
                return row.teste_hidrostatico_vencido
                    ? `<span class="badge bg-danger" title="Teste hidrostático vencido">${esc(d)}</span>`
                    : esc(d);
            },
        },
        { data: 'ativo', render: (d, type) => textoOuBadge(type, d ? 'Ativo' : 'Desativado', badgeAtivo(d)) },
        { data: null, orderable: false, searchable: false, render: (d, type, row) => menuAcoes('extintor', row) },
    ],
});

const tabelaHidrantes = $('#tabela-hidrantes').DataTable({
    language: DATATABLE_LANGUAGE,
    data: hidrantes,
    rowId: row => `hidrante-${row.id}`,
    order: [[0, 'asc']],
    dom: 'rtip',
    pageLength: 25,
    columns: [
        { data: 'codigo', render: (d, type) => textoOuBadge(type, d, `<strong>${esc(d)}</strong>`) },
        { data: 'localizacao', render: (d, type) => textoOuBadge(type, d, esc(d)) },
        {
            data: 'componentes_display',
            render: (d, type) => textoOuBadge(type, d, d ? esc(d) : '<span class="text-muted">Nenhum equipamento cadastrado</span>'),
        },
        { data: 'ativo', render: (d, type) => textoOuBadge(type, d ? 'Ativo' : 'Desativado', badgeAtivo(d)) },
        { data: null, orderable: false, searchable: false, render: (d, type, row) => menuAcoes('hidrante', row) },
    ],
});

const TABELAS = {
    extintor: { tabela: tabelaExtintores, colunaStatus: 7 },
    hidrante: { tabela: tabelaHidrantes, colunaStatus: 3 },
};

function configurarFiltros(tipo, filtroTexto, filtroStatus) {
    const { tabela, colunaStatus } = TABELAS[tipo];
    const aplicarStatus = () => {
        const valor = document.getElementById(filtroStatus).value;
        tabela.column(colunaStatus).search(valor ? `^${valor}$` : '', true, false).draw();
    };
    document.getElementById(filtroTexto).addEventListener('input', e => tabela.search(e.target.value).draw());
    document.getElementById(filtroStatus).addEventListener('change', aplicarStatus);
    aplicarStatus();
}

configurarFiltros('extintor', 'filtro-extintor', 'filtro-ativo-extintor');
configurarFiltros('hidrante', 'filtro-hidrante', 'filtro-ativo-hidrante');

// Tabela criada dentro de aba escondida fica com as colunas desalinhadas até ser redesenhada
document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(aba => {
    aba.addEventListener('shown.bs.tab', () => {
        tabelaExtintores.columns.adjust();
        tabelaHidrantes.columns.adjust();
    });
});

function buscarLinha(tipo, id) {
    return TABELAS[tipo].tabela.row(`#${tipo}-${id}`);
}

function atualizarLinha(tipo, item) {
    const { tabela } = TABELAS[tipo];
    const linha = buscarLinha(tipo, item.id);
    if (linha.any()) {
        linha.data(item).draw(false);
    } else {
        tabela.row.add(item).draw(false);
    }
    const tr = document.getElementById(`${tipo}-${item.id}`);
    if (tr) {
        tr.style.backgroundColor = '#e8f5e9';
        setTimeout(() => { tr.style.backgroundColor = ''; }, 1000);
    }
}

// ---- Extintor: criar / editar ---------------------------------------------------------------

const modalExtintor = new bootstrap.Modal(document.getElementById('modal-extintor'));
const formExtintor = document.getElementById('form-extintor');
const salvarExtintor = document.getElementById('salvar-extintor');
let extintorEditando = null;

function abrirModalExtintor(item = null) {
    extintorEditando = item ? item.id : null;
    formExtintor.reset();
    document.getElementById('modal-extintor-titulo').textContent = item ? `Editar extintor ${item.codigo}` : 'Adicionar extintor';
    if (item) {
        document.getElementById('extintor-codigo').value = item.codigo;
        document.getElementById('extintor-localizacao').value = item.localizacao;
        document.getElementById('extintor-cilindro').value = item.numero_cilindro;
        document.getElementById('extintor-agente').value = item.agente;
        document.getElementById('extintor-capacidade').value = item.capacidade_kg;
        document.getElementById('extintor-recarga').value = item.proxima_recarga;
        document.getElementById('extintor-teste').value = item.teste_hidrostatico_ano;
    }
    modalExtintor.show();
}

document.getElementById('novo-extintor').addEventListener('click', () => abrirModalExtintor());

formExtintor.addEventListener('submit', async event => {
    event.preventDefault();
    setLoading(salvarExtintor, true);
    try {
        const payload = {
            codigo: document.getElementById('extintor-codigo').value,
            localizacao: document.getElementById('extintor-localizacao').value,
            numero_cilindro: document.getElementById('extintor-cilindro').value,
            agente: document.getElementById('extintor-agente').value,
            capacidade_kg: document.getElementById('extintor-capacidade').value,
            proxima_recarga: document.getElementById('extintor-recarga').value,
            teste_hidrostatico_ano: document.getElementById('extintor-teste').value,
        };
        const data = extintorEditando
            ? await api(`/incendio/api/extintores/${extintorEditando}/`, 'PUT', payload)
            : await api('/incendio/api/extintores/', 'POST', payload);
        modalExtintor.hide();
        atualizarLinha('extintor', data.extintor);
        ToastBottomEnd.fire({ icon: 'success', title: data.message });
    } catch (error) {
        toastErro(error);
    } finally {
        setLoading(salvarExtintor, false);
    }
});

// ---- Hidrante: criar / editar ---------------------------------------------------------------

const modalHidrante = new bootstrap.Modal(document.getElementById('modal-hidrante'));
const formHidrante = document.getElementById('form-hidrante');
const salvarHidrante = document.getElementById('salvar-hidrante');
const listaComponentes = document.getElementById('lista-componentes');
let hidranteEditando = null;

function adicionarComponente(componente = { id: '', nome: '', quantidade: '' }) {
    const linha = document.createElement('div');
    linha.className = 'd-flex gap-2 align-items-center componente-linha';
    linha.dataset.id = componente.id ?? '';
    linha.innerHTML = `
        <input type="text" class="form-control text-modal componente-nome" placeholder="Ex.: Mangueira 15m" maxlength="100"
               value="${esc(componente.nome)}" required>
        <input type="number" class="form-control text-modal componente-quantidade" placeholder="Qtd." min="0"
               style="max-width: 110px" value="${componente.quantidade ?? ''}">
        <button type="button" class="btn btn-outline-danger remover-componente" title="Remover item">
            <i class="bi bi-trash"></i>
        </button>`;
    listaComponentes.appendChild(linha);
}

listaComponentes.addEventListener('click', event => {
    const botao = event.target.closest('.remover-componente');
    if (botao) botao.closest('.componente-linha').remove();
});

document.getElementById('adicionar-componente').addEventListener('click', () => adicionarComponente());

function abrirModalHidrante(item = null) {
    hidranteEditando = item ? item.id : null;
    formHidrante.reset();
    listaComponentes.innerHTML = '';
    document.getElementById('modal-hidrante-titulo').textContent = item ? `Editar hidrante ${item.codigo}` : 'Adicionar hidrante';
    if (item) {
        document.getElementById('hidrante-codigo').value = item.codigo;
        document.getElementById('hidrante-localizacao').value = item.localizacao;
        item.componentes.forEach(c => adicionarComponente(c));
    } else {
        ['Mangueira 15m', 'Esguicho', 'Chave'].forEach(nome => adicionarComponente({ id: '', nome, quantidade: 1 }));
    }
    modalHidrante.show();
}

document.getElementById('novo-hidrante').addEventListener('click', () => abrirModalHidrante());

formHidrante.addEventListener('submit', async event => {
    event.preventDefault();
    setLoading(salvarHidrante, true);
    try {
        const payload = {
            codigo: document.getElementById('hidrante-codigo').value,
            localizacao: document.getElementById('hidrante-localizacao').value,
            componentes: [...listaComponentes.querySelectorAll('.componente-linha')].map(linha => ({
                id: linha.dataset.id ? parseInt(linha.dataset.id) : null,
                nome: linha.querySelector('.componente-nome').value,
                quantidade: linha.querySelector('.componente-quantidade').value,
            })),
        };
        const data = hidranteEditando
            ? await api(`/incendio/api/hidrantes/${hidranteEditando}/`, 'PUT', payload)
            : await api('/incendio/api/hidrantes/', 'POST', payload);
        modalHidrante.hide();
        atualizarLinha('hidrante', data.hidrante);
        ToastBottomEnd.fire({ icon: 'success', title: data.message });
    } catch (error) {
        toastErro(error);
    } finally {
        setLoading(salvarHidrante, false);
    }
});

// ---- Ativar / desativar ---------------------------------------------------------------------

const modalStatus = new bootstrap.Modal(document.getElementById('modal-status'));
const confirmarStatus = document.getElementById('confirmar-status');
let statusAlvo = null;

function abrirModalStatus(tipo, item) {
    statusAlvo = { tipo, id: item.id };
    const verbo = item.ativo ? 'desativar' : 'ativar';
    const nome = tipo === 'extintor' ? 'o extintor' : 'o hidrante';
    document.getElementById('modal-status-titulo').textContent = item.ativo ? 'Desativar' : 'Ativar';
    document.getElementById('modal-status-texto').innerHTML =
        `Tem certeza que deseja ${verbo} ${nome} <strong>${esc(item.codigo)}</strong> (${esc(item.localizacao)})?` +
        (item.ativo ? '<br>Ele deixa de aparecer para inspeção, mas o histórico é mantido.' : '');
    confirmarStatus.classList.toggle('btn-danger', item.ativo);
    confirmarStatus.classList.toggle('btn-success', !item.ativo);
    modalStatus.show();
}

confirmarStatus.addEventListener('click', async () => {
    setLoading(confirmarStatus, true);
    try {
        const { tipo, id } = statusAlvo;
        const url = tipo === 'extintor' ? `/incendio/api/extintores/${id}/` : `/incendio/api/hidrantes/${id}/`;
        const data = await api(url, 'PATCH');
        const item = { ...buscarLinha(tipo, id).data(), ativo: data.novo_status };
        modalStatus.hide();
        atualizarLinha(tipo, item);
        ToastBottomEnd.fire({ icon: 'success', title: data.message });
    } catch (error) {
        toastErro(error);
    } finally {
        setLoading(confirmarStatus, false);
    }
});

// ---- QR Code --------------------------------------------------------------------------------

const modalQrcode = new bootstrap.Modal(document.getElementById('modal-qrcode'));

function abrirQrcode(tipo, item) {
    document.getElementById('qrcode-titulo').textContent = `QR Code – ${item.codigo}`;
    document.getElementById('qrcode-local').textContent = item.localizacao;
    document.getElementById('qrcode-imagem').src = `/incendio/qrcode/${tipo}/${item.id}/`;
    document.getElementById('qrcode-imprimir').href = `/incendio/etiquetas/?tipo=${tipo}&ids=${item.id}`;
    document.getElementById('qrcode-inspecionar').href = item.url_inspecao;
    modalQrcode.show();
}

// ---- Menu de ações --------------------------------------------------------------------------

document.addEventListener('click', event => {
    const link = event.target.closest('.acao');
    if (!link) return;
    event.preventDefault();
    const { acao, tipo, id } = link.dataset;
    const item = buscarLinha(tipo, id).data();
    if (!item) return;

    if (acao === 'editar') {
        tipo === 'extintor' ? abrirModalExtintor(item) : abrirModalHidrante(item);
    } else if (acao === 'qrcode') {
        abrirQrcode(tipo, item);
    } else if (acao === 'historico') {
        abrirHistorico(tipo, item.id, `${item.codigo} – ${item.localizacao}`);
    } else if (acao === 'status') {
        abrirModalStatus(tipo, item);
    }
});
