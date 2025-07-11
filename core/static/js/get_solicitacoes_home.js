// Inicializa a DataTable para solicitações
export var solicitacoesTable = $('#tabela-solicitacoes').DataTable({
    serverSide: true,
    processing: true,
    ajax: {
        url: '/core/solicitacoes/',  // Atualize com sua URL correta
        type: 'GET',
        data: function(d) {
            return {
                page: Math.ceil((d.start + 1) / d.length),
                per_page: d.length,
                search: d.search.value,
                // Adicione outros filtros se necessário
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
            data: 'itens',
            render: function(data, type, row) {
                var html = '<div class="d-flex flex-column">' +
                            '<button class="btn btn-sm btn-outline-dark btn-collapse fw-bold" ' +
                                    'data-id="' + row.id + '" ' +
                                    'data-shown="false">' +
                                '<span class="item-count fw-bold">' + data.length + ' item(s)</span>' +
                                '<i class="bi bi-chevron-down"></i>' +
                            '</button>' +
                            '<div class="itens-list mt-2" id="itens-' + row.id + '" style="display: none;">' +
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
                                Cancelar Solicitação
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

// Carrega a tabela quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    solicitacoesTable.ajax.reload();
});