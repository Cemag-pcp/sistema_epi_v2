// Módulo independente: não importa do scripts.js compartilhado porque o navegador pode ter uma versão
// antiga dele em cache, sem algum export, e aí o import falha e nenhum JS da página roda.

function getCookie(name) {
    const cookie = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.substring(name.length + 1)) : null;
}

export const ToastBottomEnd = Swal.mixin({
    toast: true,
    position: 'bottom-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: toast => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
    },
});

export const DATATABLE_LANGUAGE = { url: '//cdn.datatables.net/plug-ins/1.11.5/i18n/pt-BR.json' };

export function esc(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// fetch com CSRF e JSON; lança Error com a mensagem do backend quando a resposta não é ok
export async function api(url, method = 'GET', body = null) {
    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: body ? JSON.stringify(body) : null,
    });
    let data = {};
    try {
        data = await response.json();
    } catch (e) {
        throw new Error('Resposta inválida do servidor');
    }
    if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Erro desconhecido');
    }
    return data;
}

export function setLoading(button, loading) {
    const spinner = button.querySelector('.spinner-border');
    if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
    button.disabled = loading;
}

export function toastErro(error) {
    console.error(error);
    ToastBottomEnd.fire({ icon: 'error', title: error.message || 'Erro inesperado' });
}

const RESULTADO_BADGE = {
    ok: '<span class="badge bg-success">OK</span>',
    nok: '<span class="badge bg-danger">NOK</span>',
    na: '<span class="badge bg-secondary">N/A</span>',
};

export function badgeResultado(valor) {
    return RESULTADO_BADGE[valor] || '-';
}

export function badgeStatus(status, display) {
    const classe = { aprovado: 'status-approved', reprovado: 'status-declined', nao_avaliado: 'status-peding' }[status];
    return `<span class="badge rounded-pill ${classe || ''}">${esc(display)}</span>`;
}

export function badgeAtivo(ativo) {
    return ativo
        ? '<span class="badge rounded-pill status-approved">Ativo</span>'
        : '<span class="badge rounded-pill status-declined">Desativado</span>';
}

// ---- Histórico do equipamento ---------------------------------------------------------------

const ICONE_ACAO = {
    criado: 'bi-plus-circle text-primary',
    editado: 'bi-pencil text-warning',
    ativado: 'bi-toggle-on text-success',
    desativado: 'bi-toggle-off text-danger',
    inspecionado: 'bi-clipboard-check text-success',
    inspecao_editada: 'bi-clipboard text-warning',
    inspecao_excluida: 'bi-clipboard-x text-danger',
};

export async function abrirHistorico(tipo, id, titulo) {
    const modalEl = document.getElementById('modal-historico');
    const lista = document.getElementById('historico-lista');
    document.getElementById('historico-titulo').textContent = titulo;
    lista.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    bootstrap.Modal.getOrCreateInstance(modalEl).show();

    try {
        const data = await api(`/incendio/api/historico/${tipo}/${id}/`);
        if (!data.historico.length) {
            lista.innerHTML = '<p class="text-muted text-center py-4 mb-0">Nenhum registro.</p>';
            return;
        }
        lista.innerHTML = data.historico.map(r => `
            <li class="list-group-item d-flex gap-3">
                <i class="bi ${ICONE_ACAO[r.acao] || 'bi-dot'} fs-5"></i>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between flex-wrap gap-2">
                        <strong>${esc(r.acao_display)}</strong>
                        <small class="text-muted">${esc(r.data)} • ${esc(r.usuario)}</small>
                    </div>
                    ${r.descricao ? `<div class="small text-muted">${esc(r.descricao)}</div>` : ''}
                </div>
            </li>`).join('');
    } catch (error) {
        lista.innerHTML = `<p class="text-danger text-center py-4 mb-0">${esc(error.message)}</p>`;
    }
}
