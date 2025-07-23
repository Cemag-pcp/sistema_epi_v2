import { getCookie, ToastBottomEnd } from "../../../static/js/scripts.js";

document.addEventListener('DOMContentLoaded', function() {
    let currentPage = 1;
    const itemsPerPage = 10;
    const container = document.getElementById('container-dashboard');
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container mt-4';
    container.after(paginationContainer);

    // Função para carregar o dashboard
    function loadDashboard(page = 1) {
        currentPage = page;
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border" style="width: 3rem; height: 3rem;" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Carregando solicitações...</p>
            </div>
        `;

        fetch(`/core/dashboard/cards/?page=${page}`, {
            headers: {
                'Accept': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
        .then(response => {
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return response.text().then(text => {
                    throw new Error('Resposta não é JSON: ' + text.substring(0, 100));
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                renderDashboard(data.solicitacoes);
                renderPagination(data.pagination);
            } else {
                throw new Error(data.message || 'Erro ao carregar os dados');
            }
        })
        .catch(error => {
            console.error('Erro ao carregar o dashboard:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    Erro ao carregar o dashboard. 
                    <button class="btn btn-sm btn-link" onclick="location.reload()">Recarregar</button>
                </div>
            `;
            ToastBottomEnd.fire({
                icon: 'error',
                title: 'Erro ao carregar o dashboard',
                text: error.message || error
            });
        });
    }

    // Função para renderizar os cards
    function renderDashboard(solicitacoes) {
        if (!solicitacoes || solicitacoes.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    Nenhuma solicitação pendente no momento.
                </div>
            `;
            return;
        }

        let html = '<div class="row">';
        
        solicitacoes.forEach(solicitacao => {
            let itensHtml = '';
            solicitacao.itens.forEach(item => {
                itensHtml += `
                    <p>
                        <strong>${item.equipamento}</strong> (x${item.quantidade})<br>
                        <small>Motivo: ${item.motivo}</small><br>
                        ${item.observacoes ? `<small>Obs: ${item.observacoes}</small>` : ''}
                    </p>
                    <hr>
                `;
            });

            // Calcula o tempo decorrido
            const timestampAtual = Math.floor(Date.now() / 1000);
            const tempoDecorrido = timestampAtual - solicitacao.timestamp_solicitacao;
            const tempoFormatado = formatarTempo(tempoDecorrido);

            html += `
                <div class="col-md-4 mb-4">
                    <div class="card p-3 card-solicitacao">
                        <div>
                            <h5>Solicitação #${solicitacao.id}</h5>
                            <span class="badge badge-primary badge-status status-peding">
                                ${solicitacao.status}
                            </span>
                            <div class="tempo-aberto mt-2 mb-2">
                                <small class="text-muted">
                                    <i class="far fa-clock"></i> Aberta há: 
                                    <span class="tempo-decorrido" data-timestamp="${solicitacao.timestamp_solicitacao}">
                                        ${tempoFormatado}
                                    </span>
                                </small>
                            </div>
                            
                            <p class="mt-2">
                                <strong>👤 Solicitante:</strong> ${solicitacao.solicitante}<br>
                                <strong>👷 Funcionário:</strong> ${solicitacao.funcionario}<br>
                                <strong>📅 Data:</strong> ${solicitacao.data_solicitacao}<br>
                                ${solicitacao.observacoes ? `<strong>📝 Observações:</strong> ${solicitacao.observacoes}` : ''}
                            </p>
                            
                            <h6 class="mt-3">Itens solicitados:</h6>
                            <div class="itens-solicitacao">
                                ${itensHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
        
        // Inicia a atualização dos timers
        iniciarAtualizacaoTempo();
    }

    // Função para renderizar a paginação
    function renderPagination(pagination) {
        paginationContainer.innerHTML = '';
        
        if (pagination.total_pages <= 1) return;

        const paginationEl = document.createElement('nav');
        paginationEl.setAttribute('aria-label', 'Page navigation');
        
        let paginationHtml = `
            <ul class="pagination justify-content-center">
        `;

        // Botão Anterior
        paginationHtml += `
            <li class="page-item ${!pagination.has_previous ? 'disabled' : ''}" style="color: #6c757d;">
                <button class="page-link" ${!pagination.has_previous ? 'disabled' : ''} 
                    onclick="loadDashboard(${pagination.current_page - 1})">
                    &laquo; Anterior
                </button>
            </li>
        `;

        // Páginas
        const startPage = Math.max(1, pagination.current_page - 2);
        const endPage = Math.min(pagination.total_pages, pagination.current_page + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <li class="page-item ${i === pagination.current_page ? 'active' : ''}">
                    <button class="page-link" onclick="loadDashboard(${i})">
                        ${i}
                    </button>
                </li>
            `;
        }

        // Botão Próximo
        paginationHtml += `
            <li class="page-item ${!pagination.has_next ? 'disabled' : ''}">
                <button class="page-link" ${!pagination.has_next ? 'disabled' : ''} 
                    onclick="loadDashboard(${pagination.current_page + 1})">
                    Próxima &raquo;
                </button>
            </li>
        `;

        paginationHtml += `</ul>`;
        paginationEl.innerHTML = paginationHtml;
        paginationContainer.appendChild(paginationEl);
    }

    // Função para formatar o tempo decorrido
    function formatarTempo(segundos) {
        const dias = Math.floor(segundos / (60 * 60 * 24));
        const horas = Math.floor((segundos % (60 * 60 * 24)) / 3600);
        const minutos = Math.floor((segundos % 3600) / 60);
        const segundosRestantes = segundos % 60;

        let resultado = '';

        if (dias > 0) {
            resultado += `${dias}d `;
        }
        if (horas > 0 || dias > 0) {
            resultado += `${horas}h `;
        }
        if (minutos > 0 || horas > 0 || dias > 0) {
            resultado += `${minutos}m `;
        }

        resultado += `${segundosRestantes}s`;

        return resultado.trim();
    }

    // Função para atualizar os tempos decorridos
    function atualizarTempos() {
        const timestampAtual = Math.floor(Date.now() / 1000);
        document.querySelectorAll('.tempo-decorrido').forEach(elemento => {
            const timestampSolicitacao = parseInt(elemento.dataset.timestamp);
            const tempoDecorrido = timestampAtual - timestampSolicitacao;
            elemento.textContent = formatarTempo(tempoDecorrido);
        });
    }

    // Inicia a atualização periódica dos timers
    let intervaloAtualizacao;
    function iniciarAtualizacaoTempo() {
        // Limpa qualquer intervalo existente
        if (intervaloAtualizacao) {
            clearInterval(intervaloAtualizacao);
        }
        
        // Atualiza imediatamente e depois a cada segundo
        atualizarTempos();
        intervaloAtualizacao = setInterval(atualizarTempos, 1000);
    }

    // Torna a função loadDashboard acessível globalmente para os botões de paginação
    window.loadDashboard = loadDashboard;

    // Inicia o carregamento do dashboard
    loadDashboard();
});