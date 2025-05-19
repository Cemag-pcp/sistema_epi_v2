$(document).ready(function() {
    
    var table = $('#tabelaEquipamentos').DataTable({
        "language": {
        "url": "//cdn.datatables.net/plug-ins/1.11.5/i18n/pt-BR.json"
        },
        "columnDefs": [
        { "orderable": false, "targets": 5 }, // Desativa ordenação na coluna de Ações
        { "searchable": false, "targets": 5 } // Desativa busca na coluna de Ações
        ],
        "dom": 'lrtip' // Remove o search box
    });

    // Filter by ID
    $('#filterId').keyup(function() {
        table.column(0).search(this.value).draw();
    });

    // Filter by Nome
    $('#filterNome').keyup(function() {
        table.column(1).search(this.value).draw();
    });

    // Filter by Codigo (which is part of column 1)
    $('#filterCodigo').keyup(function() {
        table.column(1).nodes().to$().each(function() {
        var codigo = $(this).find('.text-muted').text().replace('Código ', '');
        $(this).parent().toggle(
            codigo.toLowerCase().includes($('#filterCodigo').val().toLowerCase())
        );
        });
    });

    // Filter by Vida Util
    $('#filterVidaUtil').keyup(function() {
        table.column(2).search(this.value).draw();
    });

    // Filter by CA
    $('#filterCa').keyup(function() {
        table.column(3).search(this.value).draw();
    });

    // Filter by Ativo
    $('#filterAtivo').change(function() {
        var value = $(this).val();
        if (value === "") {
            table.column(4).search('').draw();
        } else {
            table.column(4).search(value).draw();
        }
    });
});