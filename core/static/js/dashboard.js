import { getCookie, ToastBottomEnd } from "../../../static/js/scripts.js";

document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('container-dashboard');
    let refreshInterval;
    let isFirstLoad = true; // Flag para controlar a primeira carga

    // Função para carregar o dashboard
    function loadDashboard() {
        // Mostra spinner apenas na primeira carga
        if (isFirstLoad) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border" style="width: 3rem; height: 3rem;" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Carregando solicitações...</p>
                </div>
            `;
        }

        fetch('/core/dashboard/cards/', {
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
                isFirstLoad = false; // Marca que a primeira carga já foi feita
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
            // Tenta recarregar novamente após 10 segundos mesmo em caso de erro
            setTimeout(loadDashboard, 10000);
        });
    }

    // Função para renderizar os cards (mantida igual)
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
        
        // Agenda a próxima atualização do dashboard em 10 segundos
        clearInterval(refreshInterval);
        refreshInterval = setInterval(loadDashboard, 10000);
    }

    // Funções auxiliares (mantidas iguais)
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

    function atualizarTempos() {
        const timestampAtual = Math.floor(Date.now() / 1000);
        document.querySelectorAll('.tempo-decorrido').forEach(elemento => {
            const timestampSolicitacao = parseInt(elemento.dataset.timestamp);
            const tempoDecorrido = timestampAtual - timestampSolicitacao;
            elemento.textContent = formatarTempo(tempoDecorrido);
        });
    }

    let intervaloAtualizacao;
    function iniciarAtualizacaoTempo() {
        if (intervaloAtualizacao) {
            clearInterval(intervaloAtualizacao);
        }
        atualizarTempos();
        intervaloAtualizacao = setInterval(atualizarTempos, 1000);
    }

    // Inicia o carregamento do dashboard
    loadDashboard();

    // Limpa o intervalo quando a página é descarregada
    window.addEventListener('beforeunload', function() {
        clearInterval(refreshInterval);
        clearInterval(intervaloAtualizacao);
    });
});