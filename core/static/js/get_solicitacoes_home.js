// Inicializa a DataTable para solicitações
export var solicitacoesTable = $('#tabela-solicitacoes').DataTable({
    serverSide: true,
    processing: true,
    ajax: {
        url: '/core/solicitacoes',  // Atualize com sua URL correta
        type: 'GET',
        data: function(d) {
            return {
                page: Math.ceil((d.start + 1) / d.length),
                per_page: d.length,
                search: d.search.value,
                // Adicione outros filtros se necessário
                sort: d.columns[d.order[0].column].name || 'solicitacao__data_solicitacao',
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
            data: 'solicitacao_id',
            name: 'solicitacao__id',
            className: 'text-center',
            render: function(data) {
                return '<div class="d-flex justify-content-center align-items-center bg-primary bg-opacity-10 text-primary rounded-circle mx-auto" style="width: 40px; height: 40px; font-weight: bold;">' +
                        data +
                       '</div>';
            }
        },
        { 
            data: 'data_solicitacao',
            name: 'solicitacao__data_solicitacao',
            render: function(data) {
                const date = new Date(data);
                return date.toLocaleDateString('pt-BR');
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
                                    'data-id="' + row.solicitacao_id + '" ' +
                                    'data-shown="false">' +
                                '<span class="item-count fw-bold">' + data.length + ' item(s)</span>' +
                                '<i class="bi bi-chevron-down"></i>' +
                            '</button>' +
                            '<div class="itens-list mt-2" id="itens-' + row.solicitacao_id + '" style="display: none;">' +
                                '<div class="d-flex flex-column gap-2">';
                
                data.forEach(function(item) {
                    html += '<div class="equipment-detail">' +
                                '<strong>Equipamento:</strong> ' + item.equipamento_nome + '<br>' +
                                '<strong>Quantidade:</strong> ' + item.quantidade + '<br>' +
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
            name: 'solicitacao__status',
            render: function(data) {
                if (data === 'Pendente') {
                    return '<button class="btn btn-yellow fw-bold button-assinatura">Assinatura Pendente</button>';
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
                return '<div class="dropdown">' +
                            '<button class="btn btn-link btn-sm btn-rounded" type="button" id="dropdownMenuButton" data-bs-toggle="dropdown" aria-expanded="false">' +
                                '<i class="bi bi-three-dots" style="color: black"></i>' +
                            '</button>' +
                            '<ul class="dropdown-menu" aria-labelledby="dropdownMenuButton">' +
                                '<li>' +
                                    '<a data-id="' + data + '"' +
                                        'data-nome="' + row.funcionario_nome + '"' +
                                        'class="dropdown-item g-4 abrirModalEditarPadrao" style="cursor: pointer;">' +
                                        '<i class="bi bi-pencil-square" style="margin-right: 8px; pointer-events: none;"></i>' +
                                        'Editar' +
                                    '</a>' +
                                '</li>' +
                                '<li>' +
                                    '<a class="dropdown-item g-4 abrirModalDesativarPadrao" ' +
                                        'data-nome="' + row.funcionario_nome + '" data-id="' + data + '" ' +
                                        'style="color: #dc2626; cursor: pointer;">' +
                                        '<i class="bi bi-trash" style="margin-right: 8px; pointer-events: none;"></i>' +
                                        'Excluir' +
                                    '</a>' +
                                '</li>' +
                            '</ul>' +
                        '</div>';
            }
        }
    ],
    order: [[1, 'desc']],  // Ordena por data de solicitação decrescente por padrão
    lengthChange: false,
    pageLength: 10,
    language: {
        url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json',
        loadingRecords: "",
        processing: "",
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