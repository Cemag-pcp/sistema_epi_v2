import { employees, showAlert, handleDeleteClick, handleEditClick, fetchEmployees } from "./crud_funcionario.js";

export let dataTable;
// Function to initialize DataTable
export function initializeDataTable(data) {
    // Destroy existing DataTable if it exists
    if (dataTable) {
        dataTable.destroy();
    }
    
    // Initialize DataTable
    dataTable = $('#employeeTable').DataTable({
        data: data,
        columns: [
            { data: 'id',
                render: function(data, type, row) {
                    return `<div class="d-flex justify-content-center align-items-center bg-primary bg-opacity-10 text-primary rounded-circle mx-auto" style="width: 40px; height: 40px; font-weight: bold;">
                                ${data}
                            </div>`;
                }
            },
            { data: 'matricula' },
            { 
                data: 'nome',
                render: function(data, type, row) {
                    if (type === 'display') {
                        return `
                            <div class="d-flex align-items-center">
                                <span class="fw-bold">${data}</span>
                            </div>
                        `;
                    }
                    return data;
                }
            },
            { data: 'setor' },
            { data: 'cargo' ,
                createdCell: function(td, cellData, rowData, row, col) {
                        td.className = 'd-none';
                    },
            },
            { data: 'responsavel',
              createdCell: function(td, cellData, rowData, row, col) {
                        td.className = 'text-center';
                    }
             },
            { 
                data: 'dataAdmissao',
                createdCell: function(td, cellData, rowData, row, col) {
                        td.className = 'd-none';
                    },
                render: function(data, type, row) {
                    if (type === 'display' || type === 'filter') {
                        return formatDateForDisplay(data);
                    }
                    return data;
                }
            },
            { 
                data: 'status',
                render: function(data, type, row) {
                    if (type === 'display') {
                        return `<span class="badge rounded-pill ${getStatusBadgeClass(data)}">${data}</span>`;
                    }
                    return data;
                }
            },
            { 
                data: 'id',
                orderable: false,
                searchable: false,
                render: function(data, type, row) {
                    if (row.status === 'Ativo'){
                        return `
                        <div class="dropdown">
                            <button class="btn btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item edit-btn" href="#" data-id="${data}"><i class="bi bi-pencil-square" style="margin-right: 8px;"></i>Editar</a></li>
                                <li><a class="dropdown-item delete-btn" href="#" data-id="${data}" style="color: #dc2626;"><i class="bi bi-trash" style="margin-right: 8px;"></i>Desativar</a></li>
                            </ul>
                        </div>
                    `;
                    }else{
                        return `
                        <div class="dropdown">
                            <button class="btn btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item">Sem ações</a></li>
                            </ul>
                        </div>
                    `;
                    }
                    
                }
            }
        ],
        language: {
            url: 'https://cdn.datatables.net/plug-ins/1.11.5/i18n/pt-BR.json',
        },
        responsive: true,
        lengthMenu: [[5, 10, 25, 50, -1], [5, 10, 25, 50, "Todos"]],
        pageLength: 10,
        initComplete: function() {
            // Add event listeners to edit and delete buttons
            $('#employeeTable').on('click', '.edit-btn', handleEditClick);
            $('#employeeTable').on('click', '.delete-btn', handleDeleteClick);
        }
    });
}




// Function to format date for display
export function formatDateForDisplay(dateString) {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(dateString));
}

// Function to get status badge class
function getStatusBadgeClass(status) {
    switch(status) {
        case "Ativo":
            return "badge badge-success rounded-pill d-inline status-approved";
        case "Desativado":
            return "badge badge-success rounded-pill d-inline status-declined";
        default:
            return "bg-secondary text-white";
    }
}