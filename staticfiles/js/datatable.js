export let table; // Exporta a variável table

export function inicializarDataTable() {
    table = $('#tabelaEquipamentos').DataTable({
        "language": {
            "url": "//cdn.datatables.net/plug-ins/1.11.5/i18n/pt-BR.json"
        },
        "columnDefs": [
            { "orderable": false, "targets": 5 },
            { "searchable": false, "targets": 5 },
            {
                targets: 1, // Coluna do nome
                type: 'string',
                render: function(data, type, row) {
                    if (type === 'sort') {
                        return $(data).find('.nome-equipamento').text();
                    }
                    return data;
                }
            },
        ],
        "dom": 'rtip'
    });
    
    // Configurar filtros
    configurarFiltros();
}

export function configurarFiltros() {
    // Filtro combinado para Nome e Código
    $('#filterEquipamento').off('keyup').on('keyup', function() {
        var searchTerm = this.value.toLowerCase();
        
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                var nome = data[1].toLowerCase(); // Coluna do nome
                var codigo = table.cell(dataIndex, 1).nodes().to$().find('.text-muted').text().replace('Código ', '').toLowerCase();
                
                return nome.includes(searchTerm) || codigo.includes(searchTerm);
            }
        );
        
        table.draw();
        $.fn.dataTable.ext.search.pop(); // Remove o filtro após aplicá-lo
    });

    // Filter by Ativo
    $('#filterAtivo').off('change').on('change', function() {
        var value = $(this).val();
        if (value === "") {
            table.column(4).search('').draw();
        } else {
            table.column(4).search(value).draw();
        }
    });
}

export function recriarTabela() {
    if ($.fn.DataTable.isDataTable('#tabelaEquipamentos')) {
        table.destroy();
    }
    inicializarDataTable();
}

$(document).ready(function() {
    inicializarDataTable();
});