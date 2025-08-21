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
    if (percentage === 100) return { label: "Conforme", color: "bg-success" };
    if (percentage >= 80) return { label: "Parcial", color: "bg-warning" };
    return { label: "Não Conforme", color: "bg-danger" };
}

// Show/hide loading state
function setLoading(loading) {
    const loadingState = document.getElementById('loadingState');
    const resultsContainer = document.getElementById('checklistResults');
    
    if (loading) {
        loadingState.style.display = 'block';
        resultsContainer.style.display = 'none';
    } else {
        loadingState.style.display = 'none';
        resultsContainer.style.display = 'block';
    }
}

// Fetch data from API
async function fetchChecklists(searchTerm = '', complianceFilter = 'all') {
    try {
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (complianceFilter !== 'all') params.append('compliance', complianceFilter);
        
        const response = await fetch(`/api/checklists/history/?${params}`);
        if (!response.ok) throw new Error('Erro ao carregar dados');
        
        return await response.json();
    } catch (error) {
        console.error('Erro:', error);
        return [];
    }
}

// Render checklists
function renderChecklists(checklists) {
    const container = document.getElementById('checklistResults');
    const emptyState = document.getElementById('emptyState');
    const resultsCount = document.getElementById('resultsCount');
    
    // Update results count
    resultsCount.textContent = `${checklists.length} checklist${checklists.length !== 1 ? 's' : ''} encontrado${checklists.length !== 1 ? 's' : ''}`;
    
    if (checklists.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('d-none');
        const emptyStateMessage = document.getElementById('emptyStateMessage');
        emptyStateMessage.textContent = "Nenhum checklist encontrado com os filtros aplicados";
        return;
    }
    
    emptyState.classList.add('d-none');
    
    let html = '';
    checklists.forEach(checklist => {
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

// Filter checklists based on search and compliance filters
async function filterChecklists() {
    const searchTerm = document.getElementById('searchInput').value;
    const complianceFilter = document.getElementById('complianceFilter').value;
    
    setLoading(true);
    try {
        const checklists = await fetchChecklists(searchTerm, complianceFilter);
        renderChecklists(checklists);
    } catch (error) {
        console.error('Erro:', error);
        // Mostrar mensagem de erro
        const container = document.getElementById('checklistResults');
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Erro ao carregar dados. Tente novamente.
            </div>
        `;
    } finally {
        setLoading(false);
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Initial load
    filterChecklists();
    
    // Add event listeners for filtering
    document.getElementById('searchInput').addEventListener('input', filterChecklists);
    document.getElementById('complianceFilter').addEventListener('change', filterChecklists);
    
    // Debounce para pesquisa
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filterChecklists, 300);
    });
});