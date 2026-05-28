let searchTimeout;
let currentController = null;
let paginacaoAtual = {
    current_page: 1,
    total_pages: 1,
    has_next: false,
    has_previous: false,
    total_count: 0
};
let exportModalInstance = null;

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatPeriodLabel(startDate, endDate) {
    if (startDate && endDate) {
        return `${startDate.split('-').reverse().join('/')} até ${endDate.split('-').reverse().join('/')}`;
    }

    if (startDate) {
        return `A partir de ${startDate.split('-').reverse().join('/')}`;
    }

    if (endDate) {
        return `Até ${endDate.split('-').reverse().join('/')}`;
    }

    return 'Todo o período';
}

function getCompliancePercentage(stats) {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.compliant / stats.total) * 100);
}

function getComplianceStatus(stats) {
    const percentage = getCompliancePercentage(stats);
    if (percentage === 100) return { label: "Totalmente Conforme", color: "bg-success" };
    if (percentage >= 80) return { label: "Parcial", color: "bg-warning" };
    return { label: "Com Não Conformidades", color: "bg-danger" };
}

function setLoading(loading) {
    const loadingState = document.getElementById('loadingState');
    const resultsContainer = document.getElementById('checklistResults');
    const paginationContainer = document.getElementById('pagination-container');

    if (loading) {
        loadingState.style.display = 'block';
        resultsContainer.style.display = 'none';
        paginationContainer.style.display = 'none';
    } else {
        loadingState.style.display = 'none';
        resultsContainer.style.display = 'block';
        paginationContainer.style.display = paginacaoAtual.total_pages > 1 ? 'block' : 'none';
    }
}

function getCurrentFilters() {
    return {
        searchTerm: document.getElementById('searchInput').value.trim(),
        complianceFilter: document.getElementById('complianceFilter').value,
        startDate: document.getElementById('startDateFilter').value,
        endDate: document.getElementById('endDateFilter').value
    };
}

function setExportError(message = '') {
    const errorElement = document.getElementById('exportNonComplianceError');
    if (!message) {
        errorElement.textContent = '';
        errorElement.classList.add('d-none');
        return;
    }

    errorElement.textContent = message;
    errorElement.classList.remove('d-none');
}

function openNonComplianceExportModal() {
    setExportError('');
    document.getElementById('exportStartDate').value = document.getElementById('startDateFilter').value;
    document.getElementById('exportEndDate').value = document.getElementById('endDateFilter').value;
    exportModalInstance.show();
}

function exportNonCompliancePdf() {
    const startDate = document.getElementById('exportStartDate').value;
    const endDate = document.getElementById('exportEndDate').value;

    if (!startDate || !endDate) {
        setExportError('Informe a data inicial e a data final.');
        return;
    }

    if (startDate > endDate) {
        setExportError('A data inicial Não pode ser maior que a data final.');
        return;
    }

    setExportError('');

    const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
    });

    window.open(`/api/checklists/history/export-non-compliance/?${params.toString()}`, '_blank');
    exportModalInstance.hide();
}

async function fetchChecklists(filters, page = 1, signal = null) {
    const params = new URLSearchParams();

    if (filters.searchTerm) params.append('search', filters.searchTerm);
    if (filters.complianceFilter !== 'all') params.append('compliance', filters.complianceFilter);
    if (filters.startDate) params.append('start_date', filters.startDate);
    if (filters.endDate) params.append('end_date', filters.endDate);
    params.append('page', page);

    const fetchOptions = {};
    if (signal) fetchOptions.signal = signal;

    const response = await fetch(`/api/checklists/history/?${params}`, fetchOptions);

    if (signal && signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    if (!response.ok) {
        throw new Error('Erro ao carregar dados');
    }

    return await response.json();
}

function updateSummary(summary = {}) {
    document.getElementById('summaryTotalInspections').textContent = summary.total_inspections ?? 0;
    document.getElementById('summaryFullyCompliant').textContent = summary.fully_compliant ?? 0;
    document.getElementById('summaryNonCompliant').textContent = summary.with_non_compliance ?? 0;
    document.getElementById('summaryPeriodLabel').textContent = formatPeriodLabel(summary.start_date, summary.end_date);
}

function renderChecklists(data) {
    const container = document.getElementById('checklistResults');
    const emptyState = document.getElementById('emptyState');
    const resultsCount = document.getElementById('resultsCount');

    paginacaoAtual = {
        current_page: data.current_page,
        total_pages: data.total_pages,
        has_next: data.has_next,
        has_previous: data.has_previous,
        total_count: data.total_count
    };

    updateSummary(data.summary);
    resultsCount.textContent = `${data.total_count} checklist${data.total_count !== 1 ? 's' : ''} encontrado${data.total_count !== 1 ? 's' : ''}`;
    atualizarPaginacao();

    if (data.checklists.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('d-none');
        document.getElementById('emptyStateMessage').textContent = 'Nenhum checklist encontrado com os filtros aplicados';
        return;
    }

    emptyState.classList.add('d-none');

    let html = '';
    data.checklists.forEach(checklist => {
        const complianceStatus = getComplianceStatus(checklist.stats);
        const compliancePercentage = getCompliancePercentage(checklist.stats);

        html += `
        <div class="card mb-3 checklist-card">
            <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1 me-3" style="min-width: 0;">
                        <div class="d-flex align-items-center mb-2">
                            <h3 class="h6 fw-medium text-truncate mb-0 me-2">${checklist.checklist.nome}</h3>
                            <span class="badge ${complianceStatus.color}">${complianceStatus.label}</span>
                        </div>

                        <div class="d-flex align-items-center text-xs text-muted flex-wrap mb-2">
                            <div class="d-flex align-items-center me-3">
                                <i class="bi bi-calendar me-1"></i>
                                <span>${formatDate(checklist.data_inspecao)}</span>
                            </div>
                            <div class="d-flex align-items-center me-3">
                                <i class="bi bi-person me-1"></i>
                                <span>${checklist.inspetor.nome}</span>
                            </div>
                            <div class="d-flex align-items-center me-3">
                                <i class="bi bi-check-circle text-success me-1"></i>
                                <span>${checklist.stats.compliant} conformes</span>
                            </div>
                            <div class="d-flex align-items-center me-3">
                                <i class="bi bi-x-circle text-danger me-1"></i>
                                <span>${checklist.stats.nonCompliant} não conformes</span>
                            </div>
                            <div class="fw-medium me-3">${compliancePercentage}%</div>
                            <div class="progress me-3" style="width: 100px;">
                                <div class="progress-bar ${complianceStatus.color}" role="progressbar" style="width: ${compliancePercentage}%" aria-valuenow="${compliancePercentage}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                        </div>
                        <div class="position-absolute top-0 end-0 m-2">
                            <a href="/checklists/inspection/edit/${checklist.id}/" class="btn btn-white">
                                <i class="bi bi-pencil"></i>
                            </a>
                        </div>
                        <p class="text-muted small mb-0">${checklist.checklist.descricao || 'Sem descrição'}</p>
                    </div>
                </div>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}

function atualizarPaginacao() {
    const paginationContainer = document.getElementById('pagination-container');
    const paginationList = paginationContainer.querySelector('ul');

    if (paginacaoAtual.total_pages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'block';
    paginationList.innerHTML = '';

    const previousItem = document.createElement('li');
    previousItem.className = `page-item ${!paginacaoAtual.has_previous ? 'disabled' : ''}`;
    previousItem.innerHTML = `
        <a class="page-link" href="#" data-page="${paginacaoAtual.current_page - 1}">
            <i class="bi bi-chevron-left"></i>
        </a>
    `;
    paginationList.appendChild(previousItem);

    const firstPageItem = document.createElement('li');
    firstPageItem.className = `page-item ${paginacaoAtual.current_page === 1 ? 'active' : ''}`;
    firstPageItem.innerHTML = `<a class="page-link" href="#" data-page="1">1</a>`;
    paginationList.appendChild(firstPageItem);

    if (paginacaoAtual.current_page > 3) {
        const ellipsisItem = document.createElement('li');
        ellipsisItem.className = 'page-item disabled';
        ellipsisItem.innerHTML = `<span class="page-link">...</span>`;
        paginationList.appendChild(ellipsisItem);
    }

    const startPage = Math.max(2, paginacaoAtual.current_page - 1);
    const endPage = Math.min(paginacaoAtual.total_pages - 1, paginacaoAtual.current_page + 1);

    for (let i = startPage; i <= endPage; i++) {
        if (i === 1 || i === paginacaoAtual.total_pages) continue;

        const pageItem = document.createElement('li');
        pageItem.className = `page-item ${i === paginacaoAtual.current_page ? 'active' : ''}`;
        pageItem.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
        paginationList.appendChild(pageItem);
    }

    if (paginacaoAtual.current_page < paginacaoAtual.total_pages - 2) {
        const ellipsisItem = document.createElement('li');
        ellipsisItem.className = 'page-item disabled';
        ellipsisItem.innerHTML = `<span class="page-link">...</span>`;
        paginationList.appendChild(ellipsisItem);
    }

    if (paginacaoAtual.total_pages > 1) {
        const lastPageItem = document.createElement('li');
        lastPageItem.className = `page-item ${paginacaoAtual.current_page === paginacaoAtual.total_pages ? 'active' : ''}`;
        lastPageItem.innerHTML = `<a class="page-link" href="#" data-page="${paginacaoAtual.total_pages}">${paginacaoAtual.total_pages}</a>`;
        paginationList.appendChild(lastPageItem);
    }

    const nextItem = document.createElement('li');
    nextItem.className = `page-item ${!paginacaoAtual.has_next ? 'disabled' : ''}`;
    nextItem.innerHTML = `
        <a class="page-link" href="#" data-page="${paginacaoAtual.current_page + 1}">
            <i class="bi bi-chevron-right"></i>
        </a>
    `;
    paginationList.appendChild(nextItem);

    paginationList.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = parseInt(this.getAttribute('data-page'));
            if (!isNaN(page) && page >= 1 && page <= paginacaoAtual.total_pages) {
                filterChecklists(page);
                document.getElementById('checklistResults').scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

async function filterChecklists(page = 1) {
    if (currentController) {
        currentController.abort();
    }

    currentController = new AbortController();
    const signal = currentController.signal;
    const filters = getCurrentFilters();

    setLoading(true);

    try {
        const data = await fetchChecklists(filters, page, signal);
        renderChecklists(data);
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Erro:', error);
            document.getElementById('checklistResults').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Erro ao carregar dados. Tente novamente.
                </div>
            `;
        }
    } finally {
        setLoading(false);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    exportModalInstance = new bootstrap.Modal(document.getElementById('nonComplianceExportModal'));

    filterChecklists();

    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => filterChecklists(1), 300);
    });

    document.getElementById('complianceFilter').addEventListener('change', function() {
        filterChecklists(1);
    });

    document.getElementById('startDateFilter').addEventListener('change', function() {
        filterChecklists(1);
    });

    document.getElementById('endDateFilter').addEventListener('change', function() {
        filterChecklists(1);
    });

    document.getElementById('clearDateFilters').addEventListener('click', function() {
        document.getElementById('startDateFilter').value = '';
        document.getElementById('endDateFilter').value = '';
        filterChecklists(1);
    });

    document.getElementById('openNonComplianceExportModal').addEventListener('click', openNonComplianceExportModal);
    document.getElementById('confirmNonComplianceExport').addEventListener('click', exportNonCompliancePdf);
});
