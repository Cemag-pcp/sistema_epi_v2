// Variáveis globais para controle de requisições e paginação
let searchTimeout;
let currentController = null;
let paginacaoAtual = {
    current_page: 1,
    total_pages: 1,
    has_next: false,
    has_previous: false,
    total_count: 0
};

// Format date function
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

// Get compliance percentage
function getCompliancePercentage(stats) {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.compliant / stats.total) * 100);
}

// Get compliance status
function getComplianceStatus(stats) {
    const percentage = getCompliancePercentage(stats);
    if (percentage === 100) return { label: "Totalmente Conforme", color: "bg-success" };
    if (percentage >= 80) return { label: "Parcial", color: "bg-warning" };
    return { label: "Com Não Conformidades", color: "bg-danger" };
}

// Show/hide loading state
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
        if (paginacaoAtual.total_pages > 1) {
            paginationContainer.style.display = 'block';
        }
    }
}

// Fetch data from API com suporte a AbortController
async function fetchChecklists(searchTerm = '', complianceFilter = 'all', page = 1, signal = null) {
    try {
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (complianceFilter !== 'all') params.append('compliance', complianceFilter);
        params.append('page', page);
        
        const fetchOptions = {};
        if (signal) {
            fetchOptions.signal = signal;
        }
        
        const response = await fetch(`/api/checklists/history/?${params}`, fetchOptions);
        
        // Se a requisição foi abortada, não processa a resposta
        if (signal && signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        
        if (!response.ok) throw new Error('Erro ao carregar dados');
        
        return await response.json();
    } catch (error) {
        // Re-lança o erro para ser tratado no filterChecklists
        throw error;
    }
}

// Render checklists
function renderChecklists(data) {
    const container = document.getElementById('checklistResults');
    const emptyState = document.getElementById('emptyState');
    const resultsCount = document.getElementById('resultsCount');
    
    // Atualizar estado de paginação
    paginacaoAtual = {
        current_page: data.current_page,
        total_pages: data.total_pages,
        has_next: data.has_next,
        has_previous: data.has_previous,
        total_count: data.total_count
    };
    
    // Update results count
    resultsCount.textContent = `${data.total_count} checklist${data.total_count !== 1 ? 's' : ''} encontrado${data.total_count !== 1 ? 's' : ''}`;
    
    // Atualizar paginação
    atualizarPaginacao();
    
    if (data.checklists.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('d-none');
        const emptyStateMessage = document.getElementById('emptyStateMessage');
        emptyStateMessage.textContent = "Nenhum checklist encontrado com os filtros aplicados";
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
                            
                            <!-- Progress Bar -->
                            <div class="progress me-3" style="width: 100px;">
                                <div class="progress-bar ${complianceStatus.color}" role="progressbar" style="width: ${compliancePercentage}%" aria-valuenow="${compliancePercentage}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                        </div>
                        <div class="position-absolute top-0 end-0 m-2">
                            <a href="/checklists/inspection/edit/${checklist.id}/" class="btn btn-white">
                                <i class="bi bi-pencil"></i>
                            </a>
                        </div>
                        
                        <!-- Descrição do checklist -->
                        <p class="text-muted small mb-0">${checklist.checklist.descricao || 'Sem descrição'}</p>
                        
                    </div>
                </div>
            </div>
        </div>
        `;
    });
    
    container.innerHTML = html;
}

// Função para atualizar a interface de paginação
function atualizarPaginacao() {
    const paginationContainer = document.getElementById('pagination-container');
    const paginationList = paginationContainer.querySelector('ul');
    
    // Mostrar paginação apenas se houver mais de uma página
    if (paginacaoAtual.total_pages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'block';
    paginationList.innerHTML = '';
    
    // Botão Anterior
    const previousItem = document.createElement('li');
    previousItem.className = `page-item ${!paginacaoAtual.has_previous ? 'disabled' : ''}`;
    previousItem.innerHTML = `
        <a class="page-link" href="#" data-page="${paginacaoAtual.current_page - 1}">
            <i class="bi bi-chevron-left"></i>
        </a>
    `;
    paginationList.appendChild(previousItem);
    
    // SEMPRE mostrar a primeira página
    const firstPageItem = document.createElement('li');
    firstPageItem.className = `page-item ${paginacaoAtual.current_page === 1 ? 'active' : ''}`;
    firstPageItem.innerHTML = `
        <a class="page-link" href="#" data-page="1">1</a>
    `;
    paginationList.appendChild(firstPageItem);
    
    // Adicionar ellipsis após a primeira página se necessário
    if (paginacaoAtual.current_page > 3) {
        const ellipsisItem = document.createElement('li');
        ellipsisItem.className = 'page-item disabled';
        ellipsisItem.innerHTML = `<span class="page-link">...</span>`;
        paginationList.appendChild(ellipsisItem);
    }
    
    // Páginas ao redor da página atual
    const startPage = Math.max(2, paginacaoAtual.current_page - 1);
    const endPage = Math.min(paginacaoAtual.total_pages - 1, paginacaoAtual.current_page + 1);
    
    for (let i = startPage; i <= endPage; i++) {
        // Não mostrar páginas que já foram ou serão mostradas
        if (i === 1 || i === paginacaoAtual.total_pages) continue;
        
        const pageItem = document.createElement('li');
        pageItem.className = `page-item ${i === paginacaoAtual.current_page ? 'active' : ''}`;
        pageItem.innerHTML = `
            <a class="page-link" href="#" data-page="${i}">${i}</a>
        `;
        paginationList.appendChild(pageItem);
    }
    
    // Adicionar ellipsis antes da última página se necessário
    if (paginacaoAtual.current_page < paginacaoAtual.total_pages - 2) {
        const ellipsisItem = document.createElement('li');
        ellipsisItem.className = 'page-item disabled';
        ellipsisItem.innerHTML = `<span class="page-link">...</span>`;
        paginationList.appendChild(ellipsisItem);
    }
    
    // SEMPRE mostrar a última página (se houver mais de 1 página)
    if (paginacaoAtual.total_pages > 1) {
        const lastPageItem = document.createElement('li');
        lastPageItem.className = `page-item ${paginacaoAtual.current_page === paginacaoAtual.total_pages ? 'active' : ''}`;
        lastPageItem.innerHTML = `
            <a class="page-link" href="#" data-page="${paginacaoAtual.total_pages}">${paginacaoAtual.total_pages}</a>
        `;
        paginationList.appendChild(lastPageItem);
    }
    
    // Botão Próximo
    const nextItem = document.createElement('li');
    nextItem.className = `page-item ${!paginacaoAtual.has_next ? 'disabled' : ''}`;
    nextItem.innerHTML = `
        <a class="page-link" href="#" data-page="${paginacaoAtual.current_page + 1}">
            <i class="bi bi-chevron-right"></i>
        </a>
    `;
    paginationList.appendChild(nextItem);
    
    // Adicionar event listeners para os links de paginação
    paginationList.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = parseInt(this.getAttribute('data-page'));
            if (!isNaN(page) && page >= 1 && page <= paginacaoAtual.total_pages) {
                filterChecklists(page);
                
                // Scroll suave para o topo dos resultados
                document.getElementById('checklistResults').scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Filter checklists based on search and compliance filters
async function filterChecklists(page = 1) {
    // Cancela a requisição anterior se existir
    if (currentController) {
        currentController.abort();
    }
    
    // Cria um novo AbortController para esta requisição
    currentController = new AbortController();
    const signal = currentController.signal;
    
    const searchTerm = document.getElementById('searchInput').value;
    const complianceFilter = document.getElementById('complianceFilter').value;
    
    setLoading(true);
    
    try {
        const data = await fetchChecklists(searchTerm, complianceFilter, page, signal);
        renderChecklists(data);
    } catch (error) {
        // Ignora erros de aborto (quando a requisição foi cancelada)
        if (error.name !== 'AbortError') {
            console.error('Erro:', error);
            const container = document.getElementById('checklistResults');
            container.innerHTML = `
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

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Initial load
    filterChecklists();
    
    // Add event listeners for filtering
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => filterChecklists(1), 300); // Reset para página 1
    });
    
    document.getElementById('complianceFilter').addEventListener('change', function() {
        filterChecklists(1); // Reset para página 1
    });
});