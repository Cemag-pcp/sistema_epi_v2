// Função para mapear setores para ícones (lógica no frontend)
function getIconePorSetor(setorNome) {
    const iconesPorSetor = [
        'bi-gear',
        'bi-tools',
        'bi-file-text',
        'bi-shield-check',
        'bi-bar-chart',
        'bi-check-square'
    ];

    console.log(Math.floor(Math.random() * iconesPorSetor.length));
    
    return iconesPorSetor[Math.floor(Math.random() * iconesPorSetor.length)];
}

// Função para formatar a descrição
function formatarDescricao(descricao) {
    if (!descricao || descricao.trim() === '') {
        return 'Checklist de verificação e inspeção';
    }
    return descricao.length > 100 ? descricao.substring(0, 100) + '...' : descricao;
}

export function carregarCardsChecklist(){
    // Carregar cards dinamicamente
    fetch('/api/checklists/cards/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao carregar dados');
            }
            return response.json();
        })
        .then(data => {
            const container = document.getElementById('checklist-cards-container');
            
            // Remover placeholders
            document.querySelectorAll('.placeholder-card').forEach(card => {
                card.remove();
            });
            
            if (data.checklists && data.checklists.length > 0) {
                data.checklists.forEach(checklist => {
                    const icone = getIconePorSetor(checklist.setor);
                    const descricaoFormatada = formatarDescricao(checklist.descricao);
                    
                    const cardHtml = `
                        <div class="col-md-4">
                            <div class="card h-100 hover-shadow">
                                <div class="card-header bg-white p-3 position-relative">
                                    <button class="btn btn-sm btn-white position-absolute top-0 end-0 m-2 duplicate-btn" 
                                            data-bs-toggle="modal" data-bs-target="#duplicateModal" 
                                            data-checklist-id="${checklist.id}" 
                                            data-checklist-name="${checklist.nome}" 
                                            title="Duplicar">
                                        <i class="bi bi-files"></i>
                                    </button>
                                    <a href="${checklist.url_edit}" class="btn btn-sm btn-white position-absolute bottom-0 end-0 m-2 edit-btn" 
                                            data-checklist-id="${checklist.id}" 
                                            data-checklist-name="${checklist.nome}" 
                                            title="Duplicar">
                                        <i class="bi bi-pencil"></i>
                                    </a>
                                    <a href="${checklist.url_inspection}/${checklist.id}/" class="text-decoration-none text-dark inspection-btn"
                                        data-checklist-id="${checklist.id}" 
                                        data-checklist-name="${checklist.nome}">
                                        <div class="d-flex justify-content-between align-items-start">
                                            <div class="d-flex align-items-center gap-3">
                                                <div class="bg-gray rounded-circle" style="padding: 1rem 1.3rem;">
                                                    <i class="bi ${icone} fs-5 text-dark"></i>
                                                </div>
                                                <div>
                                                    <h3 class="h5 fw-semibold mb-1">${checklist.nome}</h3>
                                                    <small class="text-muted">${checklist.setor}</small>
                                                </div>
                                            </div>
                                        </div>
                                    </a>
                                </div>
                                <a href="${checklist.url_inspection}" class="text-decoration-none inspection-btn"
                                    data-checklist-id="${checklist.id}" 
                                    data-checklist-name="${checklist.nome}">
                                    <div class="card-body">
                                        <p class="text-muted small mb-4">
                                            ${descricaoFormatada}
                                        </p>

                                        <div class="d-flex justify-content-between align-items-center small text-muted mb-3">
                                            <div class="d-flex align-items-center gap-1">
                                                <i class="bi bi-file-text"></i>
                                                <span>${checklist.total_perguntas} ${checklist.total_perguntas === 1 ? 'pergunta' : 'perguntas'}</span>
                                            </div>
                                            <div class="d-flex align-items-center gap-1">
                                                <i class="bi bi-clock"></i>
                                                <span>${checklist.tempo_min}-${checklist.tempo_max} min</span>
                                            </div>
                                        </div>

                                        <div class="pt-3 border-top border-light">
                                            <div class="small fw-medium text-dark">Clique para iniciar o checklist →</div>
                                        </div>
                                    </div>
                                </a>
                            </div>
                        </div>
                    `;
                    container.innerHTML += cardHtml;
                });

                // Configurar eventos dos botões de duplicação após carregar os cards
                document.querySelectorAll('.duplicate-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const checklistId = this.getAttribute('data-checklist-id');
                        const checklistName = this.getAttribute('data-checklist-name');
                        
                        document.getElementById('checklistName').value = `Cópia de ${checklistName}`;
                        document.getElementById('originalChecklistId').value = checklistId;
                    });
                });
            } else {
                // Mensagem caso não haja checklists
                container.innerHTML += `
                    <div class="col-12">
                        <div class="alert alert-info text-center">
                            <i class="bi bi-info-circle me-2"></i>
                            Nenhum checklist disponível no momento.
                        </div>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Erro ao carregar checklists:', error);
            
            // Remover placeholders em caso de erro
            document.querySelectorAll('.placeholder-card').forEach(card => {
                card.remove();
            });
            
            const container = document.getElementById('checklist-cards-container');
            container.innerHTML += `
                <div class="col-12">
                    <div class="alert alert-danger text-center">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Erro ao carregar checklists. Tente novamente mais tarde.
                    </div>
                </div>
            `;
    });
}

export function mostrarPlaceholdersCards() {
    const container = document.getElementById('checklist-cards-container');
    
    // Remover todos os cards dinâmicos (manter apenas o card estático de adicionar)
    const cardsDinamicos = container.querySelectorAll('.col-md-4:not(:first-child)');
    cardsDinamicos.forEach(card => card.remove());
    
    // Remover mensagens de erro/info
    const mensagens = container.querySelectorAll('.alert');
    mensagens.forEach(msg => msg.remove());
    
    // Adicionar placeholders
    const placeholderHtml = `
        <div class="col-md-4 placeholder-card">
            <div class="card h-100 hover-shadow">
                <div class="card-header bg-white p-3 position-relative">
                    <div class="placeholder-glow">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="d-flex align-items-center gap-3">
                                <div class="bg-gray rounded-circle placeholder" style="padding: 1rem 1.3rem; width: 60px; height: 60px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="placeholder-glow mb-4">
                        <span class="placeholder col-12" style="height: 20px;"></span>
                    </div>
                    <div class="placeholder-glow">
                        <div class="d-flex justify-content-between align-items-center small mb-3">
                            <div class="d-flex align-items-center gap-1">
                                <span class="placeholder" style="width: 16px; height: 16px;"></span>
                                <span class="placeholder" style="width: 80px; height: 15px;"></span>
                            </div>
                            <div class="d-flex align-items-center gap-1">
                                <span class="placeholder" style="width: 16px; height: 16px;"></span>
                                <span class="placeholder" style="width: 70px; height: 15px;"></span>
                            </div>
                        </div>
                        <div class="pt-3 border-top border-light">
                            <span class="placeholder" style="width: 150px; height: 15px;"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-4 placeholder-card">
            <div class="card h-100 hover-shadow">
                <div class="card-header bg-white p-3 position-relative">
                    <div class="placeholder-glow">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="d-flex align-items-center gap-3">
                                <div class="bg-gray rounded-circle placeholder" style="padding: 1rem 1.3rem; width: 60px; height: 60px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="placeholder-glow mb-4">
                        <span class="placeholder col-12" style="height: 20px;"></span>
                    </div>
                    <div class="placeholder-glow">
                        <div class="d-flex justify-content-between align-items-center small mb-3">
                            <div class="d-flex align-items-center gap-1">
                                <span class="placeholder" style="width: 16px; height: 16px;"></span>
                                <span class="placeholder" style="width: 85px; height: 15px;"></span>
                            </div>
                            <div class="d-flex align-items-center gap-1">
                                <span class="placeholder" style="width: 16px; height: 16px;"></span>
                                <span class="placeholder" style="width: 75px; height: 15px;"></span>
                            </div>
                        </div>
                        <div class="pt-3 border-top border-light">
                            <span class="placeholder" style="width: 150px; height: 15px;"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML += placeholderHtml;
}

document.addEventListener('DOMContentLoaded', function() {
    carregarCardsChecklist();
});