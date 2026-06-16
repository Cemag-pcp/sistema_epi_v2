const API_URL = '/core/controle-trocas/api/';

let currentPage = 1;
let currentPerPage = 25;
let debounceTimer = null;
let lastStats = {};

function getFilters() {
    return {
        search: document.getElementById('searchInput').value.trim(),
        setor: document.getElementById('setorFilter').value,
        status: document.getElementById('statusFilter').value,
        page: currentPage,
        per_page: currentPerPage,
    };
}

function buildQueryString(params) {
    return Object.entries(params)
        .filter(([, v]) => v !== '' && v !== null && v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
}

async function loadData() {
    showLoading(true);

    const params = getFilters();
    const qs = buildQueryString(params);

    try {
        const resp = await fetch(`${API_URL}?${qs}`);
        if (!resp.ok) throw new Error('Erro ao carregar dados');
        const json = await resp.json();
        renderTable(json.data);
        renderPagination(json.page, json.total_pages, json.total);
        updateStats(json.stats, json.total, json.per_page, json.page);
    } catch (e) {
        console.error(e);
        showEmpty(true);
    } finally {
        showLoading(false);
    }
}

function renderTable(rows) {
    const tbody = document.getElementById('tableBody');

    if (!rows || rows.length === 0) {
        tbody.innerHTML = '';
        showEmpty(true);
        return;
    }

    showEmpty(false);

    tbody.innerHTML = rows.map(r => {
        const badgeClass = `status-${r.status}`;
        const labelMap = { vencido: 'Vencido', urgente: 'Urgente', ok: 'Em dia' };
        const diasClass =
            r.dias_restantes < 0 ? 'dias-restantes-negativo' :
            r.dias_restantes <= 30 ? 'dias-restantes-urgente' : 'dias-restantes-ok';
        const diasLabel = r.dias_restantes < 0
            ? `${Math.abs(r.dias_restantes)} dias atrás`
            : `${r.dias_restantes} dias`;

        return `<tr>
            <td>${r.funcionario_nome}</td>
            <td>${r.funcionario_matricula}</td>
            <td>${r.setor || '–'}</td>
            <td>${r.equipamento_nome}</td>
            <td><code>${r.equipamento_codigo}</code></td>
            <td>${r.data_entrega}</td>
            <td>${r.vida_util_dias} dias</td>
            <td>${r.data_troca}</td>
            <td class="${diasClass}">${diasLabel}</td>
            <td><span class="status-badge ${badgeClass}">${labelMap[r.status]}</span></td>
        </tr>`;
    }).join('');
}

function renderPagination(page, totalPages, total) {
    const nav = document.getElementById('pagination');

    if (totalPages <= 1) {
        nav.innerHTML = '';
        return;
    }

    let html = '';

    html += `<li class="page-item ${page === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="goToPage(${page - 1}); return false;">
            <i class="fas fa-chevron-left"></i>
        </a>
    </li>`;

    const range = buildPageRange(page, totalPages);
    for (const p of range) {
        if (p === '...') {
            html += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
        } else {
            html += `<li class="page-item ${p === page ? 'active' : ''}">
                <a class="page-link" href="#" onclick="goToPage(${p}); return false;">${p}</a>
            </li>`;
        }
    }

    html += `<li class="page-item ${page === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="goToPage(${page + 1}); return false;">
            <i class="fas fa-chevron-right"></i>
        </a>
    </li>`;

    nav.innerHTML = html;
}

function buildPageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current]);
    for (let i = current - 1; i <= current + 1; i++) {
        if (i >= 1 && i <= total) pages.add(i);
    }
    const sorted = Array.from(pages).sort((a, b) => a - b);
    const result = [];
    let prev = 0;
    for (const p of sorted) {
        if (p - prev > 1) result.push('...');
        result.push(p);
        prev = p;
    }
    return result;
}

function goToPage(page) {
    currentPage = page;
    loadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStats(stats, total, perPage, page) {
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statVencidos').textContent = stats.vencidos;
    document.getElementById('statUrgentes').textContent = stats.urgentes;
    document.getElementById('statEmDia').textContent = stats.em_dia;

    const start = (page - 1) * perPage + 1;
    const end = Math.min(start + perPage - 1, total);
    document.getElementById('showingCount').textContent = total > 0 ? `${start}–${end}` : 0;
    document.getElementById('totalCount').textContent = total;

    lastStats = stats;
}

function filterByStatus(status) {
    document.getElementById('statusFilter').value = status;
    currentPage = 1;
    loadData();
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('setorFilter').value = '';
    document.getElementById('statusFilter').value = '';
    currentPage = 1;
    loadData();
}

function showLoading(show) {
    document.getElementById('loadingState').classList.toggle('d-none', !show);
    document.getElementById('tableBody').closest('.table-responsive').style.display = show ? 'none' : '';
}

function showEmpty(show) {
    document.getElementById('emptyState').classList.toggle('d-none', !show);
}

// Event listeners
document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { currentPage = 1; loadData(); }, 400);
});

document.getElementById('setorFilter').addEventListener('change', () => { currentPage = 1; loadData(); });
document.getElementById('statusFilter').addEventListener('change', () => { currentPage = 1; loadData(); });

document.getElementById('pageSize').addEventListener('change', (e) => {
    currentPerPage = parseInt(e.target.value);
    currentPage = 1;
    loadData();
});

// Initial load
loadData();
