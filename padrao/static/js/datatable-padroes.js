// Inicializa a DataTable
export var table = $('#tabelaPadroes').DataTable({
    serverSide: true,
    processing: true,
    ajax: {
        url: '/padroes/api/',
        type: 'GET',
        data: function(d) {
            return {
                page: Math.ceil((d.start + 1) / d.length),
                per_page: d.length,
                search: d.search.value,
                status: document.getElementById('filterAtivo').value,
                sort: d.columns[d.order[0].column].name || 'id',
                order: d.order[0].dir || 'asc'
            };
        },
        dataSrc: function(json) {
            json.recordsTotal = json.total_count;
            json.recordsFiltered = json.total_count;
            return json.padroes;
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
            data: 'nome',
            name: 'nome',
            render: function(data) {
                return '<p class="fw-bold mb-1 nome-padrao">' + data + '</p>';
            }
        },
        { 
            data: 'setor_nome',
            name: 'setor__nome',
            render: function(data) {
                return '<p class="fw-normal mb-1 vida-util-equipamento">' + data + '</p>';
            }
        },
        { 
            data: 'funcionarios',
            name: 'funcionarios',
            render: function(data, type, row) {
                var html = '<div class="d-flex flex-column">' +
                            '<button class="btn btn-sm btn-outline-dark toggle-funcionarios" ' +
                                    'data-id="' + row.id + '" ' +
                                    'data-shown="false">' +
                                '<span class="funcionario-count fw-bold">' + data.length + ' funcionários</span>' +
                                '<i class="bi bi-chevron-down"></i>' +
                            '</button>' +
                            '<div class="funcionarios-list mt-2" id="funcionarios-' + row.id + '" style="display: none;">' +
                                '<div class="d-flex flex-column gap-2">';
                
                data.forEach(function(func) {
                    html += '<div class="d-flex align-items-center">' +
                                '<span class="badge bg-primary bg-opacity-10 me-2 text-primary" style="font-weight: bold;">' + func.matricula + '</span>' +
                                '<span>' + func.nome + '</span>' +
                            '</div>';
                });
                
                html += '</div></div></div>';
                return html;
            }
        },
        { 
            data: 'total_itens',
            render: function(data, type, row) {
                var html = '<div class="d-flex flex-column">' +
                            '<button class="btn btn-sm btn-outline-dark toggle-itens" ' +
                                    'data-id="' + row.id + '" ' +
                                    'data-shown="false">' +
                                '<span class="item-count fw-bold">' +
                                    data + ' item' + (data !== 1 ? 's' : '') +
                                '</span>' +
                                '<i class="bi bi-chevron-down"></i>' +
                            '</button>' +
                            '<div class="itens-list mt-2" id="itens-' + row.id + '" style="display: none;">' +
                                '<div class="d-flex flex-column gap-2">';
                
                row.funcionarios.forEach(function(func) {
                    if (func.itens && func.itens.length > 0) {
                        html += '<div class="d-flex flex-column">' +
                                    '<small class="text-muted">' + func.matricula + ' - ' + func.nome + '</small>' +
                                    '<div class="d-flex flex-wrap gap-1">';
                        
                        func.itens.forEach(function(item) {
                            html += '<span class="badge bg-primary bg-opacity-10 text-primary" style="font-weight: bold;">' + item.nome + ' (' + item.quantidade + ')</span>';
                        });
                        
                        html += '</div></div>';
                    }
                });
                
                html += '</div></div></div>';
                return html;
            }
        },
        { 
            data: 'ativo',
            name: 'ativo',
            render: function(data) {
                return data ? 
                    '<span class="badge badge-success rounded-pill d-inline status-approved">Ativo</span>' : 
                    '<span class="badge badge-danger rounded-pill d-inline status-declined">Desativado</span>';
            }
        },
        { 
            data: 'data_criacao',
            name: 'data_criacao',
            render: function(data) {
                return data;
            }
        },
        { 
            data: 'id',
            render: function(data, type, row) {
                return '<div class="dropdown">' +
                            '<button class="btn btn-link btn-sm btn-rounded" type="button" id="dropdownMenuButton" data-bs-toggle="dropdown" aria-expanded="false">' +
                                '<i class="bi bi-three-dots" style="color: black"></i>' +
                            '</button>' +
                            '<ul class="dropdown-menu" aria-labelledby="dropdownMenuButton">' +
                                '<li>' +
                                    '<a data-id="' + data + '"' +
                                        'data-nome="' + row.nome + '"' +
                                        'class="dropdown-item g-4 abrirModalEditarPadrao" style="cursor: pointer;">' +
                                        '<i class="bi bi-pencil-square" style="margin-right: 8px; pointer-events: none;"></i>' +
                                        'Editar' +
                                    '</a>' +
                                '</li>' +
                                '<li>' +
                                    '<a class="dropdown-item g-4 abrirModalDesativarPadrao" ' +
                                        'data-nome="' + row.nome + '" data-id="' + data + '" ' +
                                        'style="color: #dc2626; cursor: pointer;">' +
                                        '<i class="bi bi-trash" style="margin-right: 8px; pointer-events: none;"></i>' +
                                        (row.ativo ? 'Desativar' : 'Reativar') +
                                    '</a>' +
                                '</li>' +
                            '</ul>' +
                        '</div>';
            }
        }
    ],
    order: [[0, 'asc']],
    lengthChange: false,  // Isso remove o seletor "Exibir X resultados"
    pageLength: 10,
    lengthMenu: [10, 25, 50, 100],
    language: {
        url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json',
        loadingRecords: "", // Remove o texto "Carregando..."
        processing: "",     // Remove o texto "Processando..."
    },
    initComplete: function() {
        // Adiciona eventos de toggle
        document.addEventListener('click', function(e) {
            if (e.target.closest('.toggle-funcionarios')) {
                var button = e.target.closest('.toggle-funcionarios');
                var id = button.getAttribute('data-id');
                var shown = button.getAttribute('data-shown') === 'true';
                var target = document.getElementById('funcionarios-' + id);
                var icon = button.querySelector('i');
                
                target.style.display = shown ? 'none' : 'block';
                button.setAttribute('data-shown', !shown);
                icon.classList.toggle('bi-chevron-down');
                icon.classList.toggle('bi-chevron-up');
            }
            
            if (e.target.closest('.toggle-itens')) {
                var button = e.target.closest('.toggle-itens');
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

document.addEventListener('DOMContentLoaded', () =>{ 
    table.ajax.reload();
})

// Filtros
document.getElementById('button-filtrar-padrao').addEventListener('click', function() {
    const filterValue =  document.getElementById("filterPadroes").value;
    table.search(filterValue).draw();
});

document.getElementById('filterAtivo').addEventListener('change', function() {
    table.ajax.reload();
});
