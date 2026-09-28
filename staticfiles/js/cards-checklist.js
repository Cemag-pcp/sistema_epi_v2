import { ToastBottomEnd } from "../../../static/js/scripts.js";

// Variáveis para armazenar os filtros atuais
let filtrosAtuais = {
    nome: '',
    setor: '',
    maquina: '',
    maquinaNome: ''
};

let paginacaoAtual = {
    current_page: 1,
    total_pages: 1,
    has_next: false,
    has_previous: false
};

// Pasta em que o usuário está navegando (null = raiz, mostra pastas + checklists sem pasta)
let pastaAtual = { id: null, nome: null };

// Preenchido pelas duas buscas paralelas (checklists e pastas) de uma mesma rodada de
// carregarCardsChecklist(); null = ainda não respondeu. Ver avaliarMensagemVazia().
let estadoVazio = { checklists: null, pastas: null };

// Mostra/esconde o card "Nenhum checklist encontrado". Na raiz só decide depois que checklists
// E pastas já responderam, para a mensagem não piscar dependendo de qual volta primeiro.
function avaliarMensagemVazia() {
    const dentroDeUmaPasta = pastaAtual.id !== null;
    if (dentroDeUmaPasta) {
        if (estadoVazio.checklists === null) return;
        aplicarMensagemVazia(estadoVazio.checklists);
        return;
    }
    if (estadoVazio.checklists === null || estadoVazio.pastas === null) return;
    aplicarMensagemVazia(estadoVazio.checklists && estadoVazio.pastas);
}

function aplicarMensagemVazia(mostrar) {
    const container = document.getElementById('checklist-cards-container');
    container.querySelectorAll('.empty-state-card').forEach(card => card.remove());
    if (!mostrar) return;

    container.insertAdjacentHTML('beforeend', `
        <div class="col-md-4 checklist-item-card empty-state-card">
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
                           ${pastaAtual.id ? 'Esta pasta ainda não tem checklists.' : 'Ainda não há checklists. Adicione um novo para começar.'}
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
    `);
}

function lerPastaDaUrl() {
    const id = new URLSearchParams(window.location.search).get('pasta');
    return id && /^\d+$/.test(id) ? id : null;
}

// Atualiza breadcrumb, botão "Nova Pasta" e o link do card "Adicionar Novo Checklist"
// conforme a pasta atual (o checklist criado a partir de dentro de uma pasta já nasce nela).
function atualizarUiDaPasta() {
    const dentroDeUmaPasta = pastaAtual.id !== null;

    document.getElementById('pastas-breadcrumb').classList.toggle('d-none', !dentroDeUmaPasta);
    if (dentroDeUmaPasta) {
        document.getElementById('breadcrumb-pasta-atual').textContent = pastaAtual.nome || '';
    }

    const btnNovaPasta = document.getElementById('btn-nova-pasta');
    if (btnNovaPasta) btnNovaPasta.classList.toggle('d-none', dentroDeUmaPasta);

    const addLink = document.getElementById('add-checklist-link');
    if (addLink) {
        addLink.href = dentroDeUmaPasta
            ? `/checklists/add/?pasta=${pastaAtual.id}`
            : '/checklists/add/';
    }

    sincronizarSelectPastaFiltro();
}

// Pasta em que o usuário está navegando agora (cópia; não mutar o retorno)
export function obterPastaAtual() {
    return { ...pastaAtual };
}

// Navega para dentro de uma pasta (ou para a raiz, se id for null). empurraHistorico=false é
// usado ao reagir ao botão voltar/avançar do navegador, que já mudou a URL sozinho.
export function navegarParaPasta(id, nome, empurraHistorico = true) {
    pastaAtual = { id: id ? String(id) : null, nome: id ? nome : null };
    atualizarUiDaPasta();

    if (empurraHistorico) {
        const url = pastaAtual.id ? `?pasta=${pastaAtual.id}` : window.location.pathname;
        history.pushState({ pastaId: pastaAtual.id }, '', url);
    }

    carregarCardsChecklist(1);
    document.getElementById('checklist-cards-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.addEventListener('popstate', () => {
    const id = lerPastaDaUrl();
    navegarParaPasta(id, id ? pastaAtual.nome : null, false);
    // Se veio de avançar/voltar para uma pasta cujo nome não temos guardado (ex.: entrou direto
    // pela URL), o breadcrumb é preenchido assim que a API responder com "pasta_atual".
});

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

// Escapa texto vindo de fora (ex.: nome da máquina, que vem da API de manutenção)
function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
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

    // Zera o estado da rodada anterior: evita mostrar/esconder a mensagem de "vazio" com
    // base em uma pasta ou página diferente da que está sendo carregada agora. Dentro de uma
    // pasta "pastas" nunca é consultado (não há subpastas), então fica null mesmo.
    estadoVazio = { checklists: null, pastas: null };

    // Pastas só existem na raiz (um único nível, sem subpastas)
    if (pastaAtual.id === null) {
        carregarPastas();
    }

    // Construir a URL com os parâmetros de filtro e paginação
    let url = '/api/checklists/cards/';
    const params = new URLSearchParams();

    if (filtrosAtuais.nome) {
        params.append('nome', filtrosAtuais.nome);
    }

    if (filtrosAtuais.setor) {
        params.append('setor', filtrosAtuais.setor);
    }

    if (filtrosAtuais.maquina) {
        params.append('maquina_id', filtrosAtuais.maquina);
    }

    if (pastaAtual.id) {
        params.append('pasta_id', pastaAtual.id);
    }

    // Adicionar parâmetro de página
    params.append('page', page);

    if (params.toString()) {
        url += '?' + params.toString();
    }

    // Fazer a requisição com os filtros
    fetch(url)
        .then(async response => {
            if (response.status === 404) {
                // A pasta foi excluída (por este usuário em outra aba, ou por outra pessoa)
                const erro = await response.json().catch(() => ({}));
                const notFound = new Error(erro.error || 'Pasta não encontrada');
                notFound.pastaNaoEncontrada = true;
                throw notFound;
            }
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

            // A pasta pode ter sido renomeada em outra aba: alinha o breadcrumb com o servidor
            if (data.pasta_atual) {
                pastaAtual = { id: String(data.pasta_atual.id), nome: data.pasta_atual.nome };
                atualizarUiDaPasta();
            }

            // Atualizar estado de paginação
            paginacaoAtual = {
                current_page: data.current_page,
                total_pages: data.total_pages,
                has_next: data.has_next,
                has_previous: data.has_previous
            };

            // Atualizar a interface de paginação
            atualizarPaginacao();

            // Limpar cards de checklist da rodada anterior (não mexe nas pastas, que têm seu
            // próprio ciclo de carregamento independente)
            container.querySelectorAll('.checklist-item-card').forEach(card => card.remove());

            if (data.checklists && data.checklists.length > 0) {
                data.checklists.forEach(checklist => {
                    const icone = getIconePorSetor(checklist.setor);
                    const descricaoFormatada = formatarDescricao(checklist.descricao);

                    const cardHtml = `
                        <div class="col-md-4 checklist-item-card">
                            <div class="card h-100 hover-shadow">
                                <div class="card-header bg-white p-3 position-relative">
                                    <button class="btn btn-sm btn-white position-absolute top-0 end-0 m-2 duplicate-btn"
                                            data-bs-toggle="modal" data-bs-target="#duplicateModal"
                                            data-checklist-id="${checklist.id}"
                                            data-checklist-name="${checklist.nome}"
                                            title="Duplicar">
                                        <i class="bi bi-files"></i>
                                    </button>
                                    <button class="btn btn-sm btn-white position-absolute bottom-0 start-0 m-2 move-checklist-btn"
                                            data-bs-toggle="modal" data-bs-target="#moverChecklistModal"
                                            data-checklist-id="${checklist.id}"
                                            data-checklist-name="${checklist.nome}"
                                            title="Mover para pasta">
                                        <i class="bi bi-folder-symlink"></i>
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
                                                    ${checklist.maquina ? `<small class="text-muted d-block"><i class="bi bi-gear-wide-connected"></i> ${escapeHtml(checklist.maquina)}</small>` : ''}
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
                    container.insertAdjacentHTML('beforeend', cardHtml);
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

                if (filtrosAtuais.maquina) {
                    document.getElementById('itens-filtrados-maquina-checklist').style.display = 'inline-block';
                    document.getElementById('itens-filtrados-maquina-checklist').textContent = `Máquina: ${filtrosAtuais.maquinaNome}`;
                } else {
                    document.getElementById('itens-filtrados-maquina-checklist').style.display = 'none';
                }
            } else {
                // Esconder paginação quando não há resultados
                document.getElementById('pagination-container').style.display = 'none';
            }

            // As duas buscas (pastas e checklists) correm em paralelo: só decide mostrar
            // "Nenhum checklist encontrado" depois que AMBAS responderem, senão a mensagem pisca
            // na tela sempre que a de checklists volta antes da de pastas.
            estadoVazio.checklists = !(data.checklists && data.checklists.length > 0);
            avaliarMensagemVazia();
        })
        .catch(error => {
            if (error.pastaNaoEncontrada) {
                ToastBottomEnd.fire({ icon: 'warning', title: 'Esta pasta não existe mais.' });
                navegarParaPasta(null, null, true);
                return;
            }

            console.error('Erro ao carregar checklists:', error);

            // Remover placeholders em caso de erro
            document.querySelectorAll('.placeholder-card').forEach(card => {
                card.remove();
            });

            const container = document.getElementById('checklist-cards-container');
            container.insertAdjacentHTML('beforeend', `
                <div class="col-12 checklist-item-card">
                    <div class="alert alert-danger text-center">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Erro ao carregar checklists. Tente novamente mais tarde.
                    </div>
                </div>
            `);

            // Esconder paginação em caso de erro
            document.getElementById('pagination-container').style.display = 'none';
        });
}

// ---- Pastas -------------------------------------------------------------------------------

function limparPastasRenderizadas() {
    document.querySelectorAll('.folder-card-item').forEach(card => card.remove());
}

// Busca e desenha as pastas (só faz sentido na raiz; dentro de uma pasta não há subpastas)
async function carregarPastas() {
    try {
        const params = filtrosAtuais.nome ? `?nome=${encodeURIComponent(filtrosAtuais.nome)}` : '';
        const response = await fetch(`/api/checklists/pastas/${params}`);
        if (!response.ok) throw new Error('Erro ao carregar pastas');
        const { pastas } = await response.json();
        renderizarPastas(pastas);
    } catch (error) {
        console.error('Erro ao carregar pastas:', error);
        limparPastasRenderizadas();
        // Silencioso: a listagem de checklists continua funcionando sem as pastas
    }
}

function renderizarPastas(pastas) {
    document.querySelectorAll('.placeholder-card').forEach(card => card.remove());
    limparPastasRenderizadas();

    estadoVazio.pastas = pastas.length === 0;
    avaliarMensagemVazia();

    const addCard = document.getElementById('add-checklist-card');
    const html = pastas.map(pasta => `
        <div class="col-md-4 folder-card-item">
            <div class="card h-100 hover-shadow folder-card" data-pasta-id="${pasta.id}" data-pasta-nome="${escapeHtml(pasta.nome)}" role="button">
                <div class="card-body d-flex align-items-center gap-3 p-4">
                    <div class="bg-warning bg-opacity-25 rounded-circle flex-shrink-0" style="padding: 1rem 1.3rem;">
                        <i class="bi bi-folder-fill fs-4 text-warning"></i>
                    </div>
                    <div class="flex-grow-1" style="min-width: 0;">
                        <h3 class="h6 fw-semibold mb-1 text-truncate">${escapeHtml(pasta.nome)}</h3>
                        <small class="text-muted">${pasta.total_checklists} checklist${pasta.total_checklists === 1 ? '' : 's'}</small>
                    </div>
                    <div class="d-flex flex-column gap-1">
                        <button type="button" class="btn btn-sm btn-white rename-pasta-btn" data-bs-toggle="modal" data-bs-target="#renomearPastaModal" data-pasta-id="${pasta.id}" data-pasta-nome="${escapeHtml(pasta.nome)}" title="Renomear pasta">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-white delete-pasta-btn" data-bs-toggle="modal" data-bs-target="#excluirPastaModal" data-pasta-id="${pasta.id}" data-pasta-nome="${escapeHtml(pasta.nome)}" title="Excluir pasta">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    if (html) addCard.insertAdjacentHTML('afterend', html);
}

// Clique num card de pasta navega para dentro dela; clique nos botões de ação, não (delegado no
// container, então continua funcionando mesmo depois de renderizarPastas() redesenhar os cards)
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('checklist-cards-container').addEventListener('click', function(e) {
        if (e.target.closest('button')) return; // renomear/excluir cuidam de si mesmos
        const card = e.target.closest('.folder-card');
        if (!card) return;
        navegarParaPasta(card.dataset.pastaId, card.dataset.pastaNome);
    });
});

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

    // Remover todos os cards dinâmicos (pastas, checklists, mensagens) e manter só o card
    // estático de adicionar
    const cardsDinamicos = container.querySelectorAll('.col-md-4:not(#add-checklist-card), .col-12');
    cardsDinamicos.forEach(card => card.remove());

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

// Carrega as máquinas com checklist ativo no select2 do filtro
async function carregarMaquinasFiltro() {
    const select = document.getElementById('pesquisar-maquina');
    try {
        const response = await fetch('/api/checklists/maquinas-em-uso/');
        if (!response.ok) throw new Error('Erro ao carregar máquinas');
        const { maquinas } = await response.json();

        maquinas.forEach(maquina => {
            const option = document.createElement('option');
            option.value = maquina.id;
            option.textContent = maquina.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro:', error);
    }

    if (window.jQuery && jQuery.fn.select2) {
        // dropdownParent evita que o dropdown do Bootstrap feche ao clicar nas opções do select2
        jQuery(select).select2({
            theme: 'bootstrap-5',
            width: '100%',
            allowClear: true,
            placeholder: 'Pesquisar por máquina...',
            dropdownParent: jQuery('#filtro-checklists-menu'),
            language: { noResults: () => 'Nenhuma máquina encontrada' },
        });
    }
}

// Carrega as pastas no select2 do filtro (independente da pasta em que o usuário está agora:
// dá pra pular direto para qualquer outra pasta a partir dali)
async function carregarPastasFiltro() {
    const select = document.getElementById('pesquisar-pasta');
    try {
        const response = await fetch('/api/checklists/pastas/');
        if (!response.ok) throw new Error('Erro ao carregar pastas');
        const { pastas } = await response.json();

        pastas.forEach(pasta => {
            const option = document.createElement('option');
            option.value = pasta.id;
            option.textContent = pasta.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro:', error);
    }

    if (window.jQuery && jQuery.fn.select2) {
        jQuery(select).select2({
            theme: 'bootstrap-5',
            width: '100%',
            allowClear: true,
            placeholder: 'Todas as pastas',
            dropdownParent: jQuery('#filtro-checklists-menu'),
            language: { noResults: () => 'Nenhuma pasta encontrada' },
        });
    }

    sincronizarSelectPastaFiltro();
}

// Mantém o select do filtro alinhado com a pasta atual (clique no card, breadcrumb, voltar do
// navegador) para o dropdown de filtro sempre refletir onde o usuário está
function sincronizarSelectPastaFiltro() {
    const select = document.getElementById('pesquisar-pasta');
    if (!select) return;
    const valor = pastaAtual.id || '';

    if (window.jQuery && jQuery.fn.select2 && jQuery(select).data('select2')) {
        jQuery(select).val(valor).trigger('change');
    } else {
        select.value = valor;
    }
}

// Configurar eventos quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Abrir já dentro de uma pasta quando a URL traz ?pasta=<id> (link compartilhado, ou
    // voltar de outra página que preservou a pasta atual)
    const pastaInicial = lerPastaDaUrl();
    if (pastaInicial) {
        pastaAtual = { id: pastaInicial, nome: null }; // nome chega com a 1ª resposta da API
        atualizarUiDaPasta();
    }

    // Carregar cards inicialmente
    carregarCardsChecklist();
    
    // Configurar evento do botão de filtrar
    document.getElementById('btn-filtrar-checklists').addEventListener('click', function() {
        // Obter valores dos campos de filtro
        filtrosAtuais.nome = document.getElementById('pesquisar-nome').value;
        filtrosAtuais.setor = document.getElementById('pesquisar-setor').value;
        filtrosAtuais.maquina = document.getElementById('pesquisar-maquina').value;
        const maquinaSelecionada = document.getElementById('pesquisar-maquina').selectedOptions[0];
        filtrosAtuais.maquinaNome = filtrosAtuais.maquina && maquinaSelecionada ? maquinaSelecionada.textContent : '';

        const pastaSelect = document.getElementById('pesquisar-pasta');
        const pastaId = pastaSelect.value || null;
        const pastaNome = pastaId ? pastaSelect.selectedOptions[0].textContent : null;

        // Fechar o dropdown
        const dropdown = document.getElementById('dropdownMenuButton');
        const bootstrapDropdown = bootstrap.Dropdown.getInstance(dropdown);
        bootstrapDropdown.hide();

        // Trocar de pasta (ou voltar pra raiz) já recarrega os cards; senão, só reaplica os
        // outros filtros na pasta em que o usuário já está
        if (String(pastaId) !== String(pastaAtual.id)) {
            navegarParaPasta(pastaId, pastaNome);
        } else {
            carregarCardsChecklist(1);
        }
    });
    
    // Configurar evento do botão de limpar
    document.getElementById('btn-limpar-checklists').addEventListener('click', function() {
        // Limpar campos de filtro
        document.getElementById('pesquisar-nome').value = '';
        document.getElementById('pesquisar-setor').value = '';
        if (window.jQuery) {
            jQuery('#pesquisar-maquina').val(null).trigger('change');
        } else {
            document.getElementById('pesquisar-maquina').value = '';
        }

        // Limpar filtros atuais
        filtrosAtuais = {
            nome: '',
            setor: '',
            maquina: '',
            maquinaNome: ''
        };

        // Fechar o dropdown
        const dropdown = document.getElementById('dropdownMenuButton');
        const bootstrapDropdown = bootstrap.Dropdown.getInstance(dropdown);
        bootstrapDropdown.hide();

        // "Limpar" também volta para a raiz, se o usuário estiver dentro de uma pasta
        if (pastaAtual.id !== null) {
            navegarParaPasta(null, null);
        } else {
            // Recarregar os cards sem filtros (voltando para a página 1)
            carregarCardsChecklist(1);
        }
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

    carregarMaquinasFiltro();
    carregarPastasFiltro();
});