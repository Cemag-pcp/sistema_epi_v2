// Variáveis para armazenar os filtros atuais
let filtrosAtuais = {
    nome: '',
    setor: ''
};

let paginacaoAtual = {
    current_page: 1,
    total_pages: 1,
    has_next: false,
    has_previous: false
};

// Função para mapear setores para ícones (lógica no frontend)
function getIconePorSetor(setorNome) {
    const iconesPorSetor = [
        'bi-gear',
        'bi-tools',
        'bi-file-text',
        'bi-shield-check',
        'bi-bar-chart',
        'bi-check-square',
        'bi bi-archive',
        'bi bi-backpack',
        'bi bi-building-fill',
        'bi bi-clipboard-check',
    ];

    return iconesPorSetor[Math.floor(Math.random() * iconesPorSetor.length)];
}

// Função para formatar a descrição
function formatarDescricao(descricao) {
    if (!descricao || descricao.trim() === '') {
        return 'Checklist de verificação e inspeção';
    }
    return descricao.length > 100 ? descricao.substring(0, 100) + '...' : descricao;
}

// Função para carregar os cards com os filtros aplicados
export function carregarCardsChecklist(page = 1) {
    mostrarPlaceholdersCards();

    // Construir a URL com os parâmetros de filtro e paginação
    let url = '/api/checklists/cards/';
    const params = new URLSearchParams();

    if (filtrosAtuais.nome) {
        params.append('nome', filtrosAtuais.nome);
    }

    if (filtrosAtuais.setor) {
        params.append('setor', filtrosAtuais.setor);
    }

    // Adicionar parâmetro de página
    params.append('page', page);

    if (params.toString()) {
        url += '?' + params.toString();
    }

    // Fazer a requisição com os filtros
    fetch(url)
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

            // Atualizar estado de paginação
            paginacaoAtual = {
                current_page: data.current_page,
                total_pages: data.total_pages,
                has_next: data.has_next,
                has_previous: data.has_previous
            };

            // Atualizar a interface de paginação
            atualizarPaginacao();

            if (data.checklists && data.checklists.length > 0) {
                // Limpar cards existentes (exceto o card estático de adicionar)
                const cardsDinamicos = container.querySelectorAll('.col-md-4:not(:first-child)');
                cardsDinamicos.forEach(card => card.remove());

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
                                            title="Editar">
                                        <i class="bi bi-pencil"></i>
                                    </a>
                                    <a href="${checklist.url_inspection}" class="text-decoration-none text-dark inspection-btn"
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
                    btn.addEventListener('click', function () {
                        const checklistId = this.getAttribute('data-checklist-id');
                        const checklistName = this.getAttribute('data-checklist-name');

                        document.getElementById('checklistName').value = `Cópia de ${checklistName}`;
                        document.getElementById('originalChecklistId').value = checklistId;
                    });
                });

                // Mostrar filtros aplicados
                if (filtrosAtuais.nome) {
                    document.getElementById('itens-filtrados-nome-checklist').style.display = 'inline-block';
                    document.getElementById('itens-filtrados-nome-checklist').textContent = `Checklist: ${filtrosAtuais.nome}`;
                } else {
                    document.getElementById('itens-filtrados-nome-checklist').style.display = 'none';
                }

                if (filtrosAtuais.setor) {
                    document.getElementById('itens-filtrados-setor-checklist').style.display = 'inline-block';
                    document.getElementById('itens-filtrados-setor-checklist').textContent = `Setor: ${filtrosAtuais.setor}`;
                } else {
                    document.getElementById('itens-filtrados-setor-checklist').style.display = 'none';
                }
            } else {
                // Mensagem caso não haja checklists
                const container = document.getElementById('checklist-cards-container');
                // Limpar cards existentes (exceto o card estático de adicionar)
                const cardsDinamicos = container.querySelectorAll('.col-md-4:not(:first-child)');
                cardsDinamicos.forEach(card => card.remove());

                container.innerHTML += `
                        <div class="col-md-4">
                            <div class="card h-100 hover-shadow">
                                <div class="card-header bg-white p-3 position-relative">
                                    <a class="text-decoration-none text-dark inspection-btn">
                                        <div class="d-flex justify-content-between align-items-start">
                                            <div class="d-flex align-items-center gap-3">
                                                <div class="bg-gray rounded-circle" style="padding: 1rem 1.3rem;">
                                                    <i class="bi bi-emoji-frown fs-5 text-dark"></i>
                                                </div>
                                                <div>
                                                    <h3 class="h5 fw-semibold mb-1">Nenhum checklist encontrado</h3>
                                                </div>
                                            </div>
                                        </div>
                                    </a>
                                </div>
                                <a class="text-decoration-none inspection-btn">
                                    <div class="card-body">
                                        <p class="text-muted small mb-4">
                                           Ainda não há checklists. Adicione um novo para começar.  
                                        </p>

                                        <div class="d-flex justify-content-between align-items-center small text-muted mb-3">
                                            <div class="d-flex align-items-center gap-1">
                                                <i class="bi bi-file-text"></i>
                                                <span>0 perguntas</span>
                                            </div>
                                            <div class="d-flex align-items-center gap-1">
                                                <i class="bi bi-clock"></i>
                                                <span>0-0 min</span>
                                            </div>
                                        </div>
                                    </div>
                                </a>
                            </div>
                        </div>
                `;

                // Esconder paginação quando não há resultados
                document.getElementById('pagination-container').style.display = 'none';
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

            // Esconder paginação em caso de erro
            document.getElementById('pagination-container').style.display = 'none';
        });
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
                carregarCardsChecklist(page);
                
                // Scroll suave para o topo dos cards
                document.getElementById('checklist-cards-container').scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
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
    for (let i = 0; i < 2; i++) {
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
        `;

        container.innerHTML += placeholderHtml;
    }
}

// Configurar eventos quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Carregar cards inicialmente
    carregarCardsChecklist();
    
    // Configurar evento do botão de filtrar
    document.getElementById('btn-filtrar-checklists').addEventListener('click', function() {
        // Obter valores dos campos de filtro
        filtrosAtuais.nome = document.getElementById('pesquisar-nome').value;
        filtrosAtuais.setor = document.getElementById('pesquisar-setor').value;
        
        // Fechar o dropdown
        const dropdown = document.getElementById('dropdownMenuButton');
        const bootstrapDropdown = bootstrap.Dropdown.getInstance(dropdown);
        bootstrapDropdown.hide();
        
        // Recarregar os cards com os filtros aplicados (voltando para a página 1)
        carregarCardsChecklist(1);
    });
    
    // Configurar evento do botão de limpar
    document.getElementById('btn-limpar-checklists').addEventListener('click', function() {
        // Limpar campos de filtro
        document.getElementById('pesquisar-nome').value = '';
        document.getElementById('pesquisar-setor').value = '';
        
        // Limpar filtros atuais
        filtrosAtuais = {
            nome: '',
            setor: ''
        };
        
        // Fechar o dropdown
        const dropdown = document.getElementById('dropdownMenuButton');
        const bootstrapDropdown = bootstrap.Dropdown.getInstance(dropdown);
        bootstrapDropdown.hide();
        
        // Recarregar os cards sem filtros (voltando para a página 1)
        carregarCardsChecklist(1);
    });
    
    // Permitir submissão do formulário com Enter
    document.getElementById('pesquisar-nome').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btn-filtrar-checklists').click();
        }
    });
    
    document.getElementById('pesquisar-setor').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btn-filtrar-checklists').click();
        }
    });
});