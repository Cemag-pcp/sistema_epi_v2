// Inicializa a DataTable para solicitações
export var solicitacoesTable = $('#tabela-solicitacoes').DataTable({
    serverSide: true,
    processing: true,
    ajax: {
        url: '/core/solicitacoes/',
        type: 'GET',
        data: function(d) {
            return {
                page: Math.ceil((d.start + 1) / d.length),
                per_page: d.length,
                search: d.search.value,
                id_solicitacao: filtrosSolicitacoes.idSolicitacao,
                funcionario: filtrosSolicitacoes.funcionario,
                solicitante: filtrosSolicitacoes.solicitante,
                equipamento: filtrosSolicitacoes.equipamento,
                data_inicio: filtrosSolicitacoes.dataInicio,
                data_fim: filtrosSolicitacoes.dataFim,
                status: filtrosSolicitacoes.status.join(','),
                sort: d.columns[d.order[0].column].name || 'data_solicitacao',
                order: d.order[0].dir || 'desc'
            };
        },
        dataSrc: function(json) {
            json.recordsTotal = json.total_itens;
            json.recordsFiltered = json.total_itens;
            return json.dados_solicitados;
        }
    },
    columns: [
        { 
            data: 'id',
            name: 'id',
            className: 'text-center',
            render: function(data) {
                return '<div class="d-flex justify-content-center align-items-center bg-primary bg-opacity-10 text-primary rounded-circle mx-auto" style="width: 40px; height: 40px; font-weight: bold;">' +
                        data +
                       '</div>';
            }
        },
        { 
            data: 'data_solicitacao',
            name: 'data_solicitacao',
            render: function(data) {
                const date = new Date(data);
                return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR')}`;
            }
        },
        { 
            data: null,
            name: 'funcionario__nome',
            render: function(data) {
                return data.funcionario_matricula + ' - ' + data.funcionario_nome;
            }
        },
        { 
            data: null,
            name: 'solicitante__nome',
            render: function(data) {
                return data.solicitante_matricula + ' - ' + data.solicitante_nome;
            }
        },
        { 
            data: 'itens',
            render: function(data, type, row) {
                var html = '<div class="d-flex flex-column">' +
                            '<button class="btn btn-sm btn-outline-dark btn-collapse fw-bold" ' +
                                    'data-id="' + row.id + '" ' +
                                    'data-shown="false">' +
                                '<span class="item-count fw-bold">' + data.length + ' item(s)</span>' +
                                '<i class="bi bi-chevron-down"></i>' +
                            '</button>' +
                            '<div class="itens-list mt-2" id="itens-' + row.id + '" style="width:28rem; display: none;">' +
                                '<div class="d-flex flex-column gap-2">';
                
                data.forEach(function(item) {
                    html += '<div class="equipment-detail" style="font-size: 14px">' +
                                '<strong>Equipamento:</strong> ' + item.equipamento_nome + '<br>' +
                                '<strong>Quantidade:</strong> ' + item.quantidade + '<br>' +
                                '<strong>Observação:</strong> ' + item.observacoes + '<br>' +
                                '<strong>Motivo:</strong> ' + (item.motivo || 'Não informado') +
                            '</div>' +
                            '<hr>';
                });
                
                html += '</div></div></div>';
                return html;
            }
        },
        { 
            data: 'status_assinatura',
            name: 'status',
            render: function(data, type, row) {
                if (data === 'Pendente') {
                    return `<button class="btn btn-yellow fw-bold button-assinatura" data-solicitacao="${row.solicitacao_id}">
                        Assinatura Pendente
                    </button>`;
                } else if (data === 'Entregue') {
                    return '<button class="btn btn-green fw-bold" disabled>Entregue</button>';
                } else {
                    return '<button class="btn btn-red fw-bold" disabled>Cancelado</button>';
                }
            }
        },
        { 
            data: 'solicitacao_id',
            render: function(data, type, row) {
                let buttons = '';
                
                if (row.status_assinatura === 'Pendente') {
                    buttons = `
                        <li>
                            <a data-solicitacao="${data}"
                                data-nome="${row.funcionario_nome}"
                                class="dropdown-item g-4 abrirModalEditarSolicitacao" style="cursor: pointer;">
                                <i class="bi bi-pencil-square" style="margin-right: 8px; pointer-events: none;"></i>
                                Editar
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item g-4 abrirModalCancelarSolicitacao" 
                                data-nome="${row.funcionario_nome}" data-id="${data}"
                                data-action="cancelar" style="color: #dc2626; cursor: pointer;">
                                <i class="bi bi-x-circle" style="margin-right: 8px; pointer-events: none;"></i>
                                Excluir Solicitação
                            </a>
                        </li>
                    `;
                } else if (row.status_assinatura === 'Entregue') {
                    buttons = `
                        <li>
                            <a class="dropdown-item g-4 abrirModalExcluirAssinatura" 
                                data-nome="${row.funcionario_nome}" data-id="${data}" 
                                style="color: #dc2626; cursor: pointer;">
                                <i class="bi bi-trash" style="margin-right: 8px; pointer-events: none;"></i>
                                Excluir Assinatura
                            </a>
                        </li>
                    `;
                } else {
                    buttons = `
                        <li>
                            <a class="dropdown-item g-4 abrirModalCancelarSolicitacao" 
                                data-nome="${row.funcionario_nome}" data-id="${data}" 
                                data-action="reabrir" style="color:#008337; cursor: pointer;">
                                <i class="bi bi-door-open" style="margin-right: 8px; pointer-events: none;"></i>
                                Reabrir Solicitação
                            </a>
                        </li>
                    `;
                }
                // Só mostra o dropdown se houver botões para exibir

                return `<div class="dropdown">
                    <button class="btn btn-link btn-sm btn-rounded" type="button" id="dropdownMenuButton" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="bi bi-three-dots" style="color: black"></i>
                    </button>
                    <ul class="dropdown-menu" aria-labelledby="dropdownMenuButton">
                        ${buttons}
                    </ul>
                </div>`;
            }
        }
    ],
    order: [[1, 'desc']],  // Ordena por data de solicitação decrescente por padrão
    lengthChange: false,
    pageLength: 10,
    language: {
        url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json',
        loadingRecords: "",
    },
    initComplete: function() {
        // Adiciona eventos de toggle para os itens
        document.addEventListener('click', function(e) {
            if (e.target.closest('.btn-collapse')) {
                var button = e.target.closest('.btn-collapse');
                var id = button.getAttribute('data-id');
                var shown = button.getAttribute('data-shown') === 'true';
                var target = document.getElementById('itens-' + id);
                var icon = button.querySelector('i');
                
                target.style.display = shown ? 'none' : 'block';
                button.setAttribute('data-shown', !shown);
                icon.classList.toggle('bi-chevron-down');
                icon.classList.toggle('bi-chevron-up');
            }
        });
    }
});

// Variáveis para armazenar os filtros
let filtrosSolicitacoes = {
    codigoNome: '',
    equipamento: '',
    dataInicio: '',
    dataFim: '',
    status: ['Pendente', 'Entregue', 'Cancelado'],
    solicitante: ''
};

// Função para aplicar os filtros
function aplicarFiltrosSolicitacoes() {
    // Atualiza a DataTable com os filtros
    solicitacoesTable.ajax.reload();
    
    // Mostra os filtros aplicados
    atualizarFiltrosAplicados();
}

// Função para atualizar os badges de filtros aplicados
function atualizarFiltrosAplicados() {

    if (filtrosSolicitacoes.idSolicitacao) {
        document.getElementById('itens-filtrados-solicitacoes-id').style.display = 'inline-block';
        document.getElementById('itens-filtrados-solicitacoes-id').textContent = `ID: ${filtrosSolicitacoes.idSolicitacao}`;
    } else {
        document.getElementById('itens-filtrados-solicitacoes-id').style.display = 'none';
    }
    
    // Funcionário
    if (filtrosSolicitacoes.funcionario) {
        document.getElementById('itens-filtrados-solicitacoes-funcionario').style.display = 'inline-block';
        document.getElementById('itens-filtrados-solicitacoes-funcionario').textContent = `Funcionário: ${filtrosSolicitacoes.funcionario}`;
    } else {
        document.getElementById('itens-filtrados-solicitacoes-funcionario').style.display = 'none';
    }

    if (filtrosSolicitacoes.solicitante) {
        document.getElementById('itens-filtrados-solicitacoes-solicitante').style.display = 'inline-block';
        document.getElementById('itens-filtrados-solicitacoes-solicitante').textContent = `Solicitante: ${filtrosSolicitacoes.solicitante}`;
    } else {
        document.getElementById('itens-filtrados-solicitacoes-solicitante').style.display = 'none';
    }
    
    // Equipamento
    if (filtrosSolicitacoes.equipamento) {
        document.getElementById('itens-filtrados-solicitacoes-equipamento').style.display = 'inline-block';
        document.getElementById('itens-filtrados-solicitacoes-equipamento').textContent = `Equipamento: ${filtrosSolicitacoes.equipamento}`;
    } else {
        document.getElementById('itens-filtrados-solicitacoes-equipamento').style.display = 'none';
    }
    
    // Data
    if (filtrosSolicitacoes.dataInicio || filtrosSolicitacoes.dataFim) {
        document.getElementById('itens-filtrados-solicitacoes-data').style.display = 'inline-block';
        let textoData = '';
        if (filtrosSolicitacoes.dataInicio && filtrosSolicitacoes.dataFim) {
            textoData = `Data: ${filtrosSolicitacoes.dataInicio} até ${filtrosSolicitacoes.dataFim}`;
        } else if (filtrosSolicitacoes.dataInicio) {
            textoData = `Data a partir de ${filtrosSolicitacoes.dataInicio}`;
        } else {
            textoData = `Data até ${filtrosSolicitacoes.dataFim}`;
        }
        document.getElementById('itens-filtrados-solicitacoes-data').textContent = textoData;
    } else {
        document.getElementById('itens-filtrados-solicitacoes-data').style.display = 'none';
    }
    
    // Status
    if (filtrosSolicitacoes.status.length < 3) {
        document.getElementById('itens-filtrados-solicitacoes-status').style.display = 'inline-block';
        document.getElementById('itens-filtrados-solicitacoes-status').textContent = `Status: ${filtrosSolicitacoes.status.join(', ')}`;
    } else {
        document.getElementById('itens-filtrados-solicitacoes-status').style.display = 'none';
    }
}

// Evento de clique no botão Filtrar
document.getElementById('btn-filtrar-solicitacoes').addEventListener('click', function() {
    // Atualiza os filtros
    filtrosSolicitacoes.idSolicitacao = document.getElementById('pesquisar-id-solicitacao').value;
    filtrosSolicitacoes.funcionario = document.getElementById('pesquisar-funcionario').value;
    filtrosSolicitacoes.solicitante = document.getElementById('pesquisar-solicitante').value; 
    filtrosSolicitacoes.equipamento = document.getElementById('pesquisar-equipamento').value;
    filtrosSolicitacoes.dataInicio = document.getElementById('data-solicitacao-inicio').value;
    filtrosSolicitacoes.dataFim = document.getElementById('data-solicitacao-fim').value;
    
    // Atualiza os status
    filtrosSolicitacoes.status = [];
    if (document.getElementById('status_pendente').checked) {
        filtrosSolicitacoes.status.push('Pendente');
    }
    if (document.getElementById('status_entregue').checked) {
        filtrosSolicitacoes.status.push('Entregue');
    }
    if (document.getElementById('status_cancelado').checked) {
        filtrosSolicitacoes.status.push('Cancelado');
    }
    
    aplicarFiltrosSolicitacoes();
});

// Evento de clique no botão Limpar
document.getElementById('btn-limpar-solicitacoes').addEventListener('click', function() {
    // Limpa os campos
    document.getElementById('pesquisar-id-solicitacao').value = '';
    document.getElementById('pesquisar-funcionario').value = '';
    document.getElementById('pesquisar-solicitante').value = '';
    document.getElementById('pesquisar-equipamento').value = '';
    document.getElementById('data-solicitacao-inicio').value = '';
    document.getElementById('data-solicitacao-fim').value = '';
    
    // Marca todos os status
    document.getElementById('status_pendente').checked = true;
    document.getElementById('status_entregue').checked = true;
    document.getElementById('status_cancelado').checked = true;
    
    // Limpa os filtros
    filtrosSolicitacoes = {
        codigoNome: '',
        equipamento: '',
        dataInicio: '',
        dataFim: '',
        status: ['Pendente', 'Entregue', 'Cancelado'],
        solicitante: ''
    };
    
    aplicarFiltrosSolicitacoes();
});