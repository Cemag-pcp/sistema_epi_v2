import { employees, showAlert, dataTable } from "./crud_funcionario.js";

let employees_local = employees
let dataTable_local = dataTable
// Function to initialize DataTable
export function initializeDataTable(data) {
    // Destroy existing DataTable if it exists
    if (dataTable_local) {
        dataTable_local.destroy();
    }
    
    // Initialize DataTable
    dataTable_local = $('#employeeTable').DataTable({
        data: data,
        columns: [
            { data: 'matricula' },
            { 
                data: 'nome',
                render: function(data, type, row) {
                    if (type === 'display') {
                        return `
                            <div class="d-flex align-items-center">
                                <div class="profile-img me-2">
                                    <i class="bi bi-person"></i>
                                </div>
                                <span class="fw-bold">${data}</span>
                            </div>
                        `;
                    }
                    return data;
                }
            },
            { data: 'setor' },
            { data: 'cargo' },
            { data: 'responsavel' },
            { 
                data: 'dataAdmissao',
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
                    return `
                        <div class="dropdown">
                            <button class="btn btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item edit-btn" href="#" data-id="${data}">Editar</a></li>
                                <li><a class="dropdown-item delete-btn" href="#" data-id="${data}">Desativar</a></li>
                            </ul>
                        </div>
                    `;
                }
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.11.5/i18n/pt-BR.json',
        },
        responsive: true,
        lengthMenu: [[5, 10, 25, 50, -1], [5, 10, 25, 50, "Todos"]],
        pageLength: 10,
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rtip',
        initComplete: function() {
            // Add event listeners to edit and delete buttons
            $('#employeeTable').on('click', '.edit-btn', handleEditClick);
            $('#employeeTable').on('click', '.delete-btn', handleDeleteClick);
        }
    });
}

// Handle Delete button click
export function handleDeleteClick(e) {
    e.preventDefault();
    const id = e.target.dataset.id;
    
    confirmDeleteBtn.dataset.id = id;
    deleteModal.show();
}

// Handle Edit button click
export function handleEditClick(e) {
    e.preventDefault();
    const id = e.target.dataset.id;
    const employee = employees.find(emp => emp.id == id);
    
    if (employee) {
        employeeIdInput.value = employee.id;
        matriculaInput.value = employee.matricula;
        nomeInput.value = employee.nome;
        cargoInput.value = employee.cargo;
        setorInput.value = employee.setor;
        responsavelInput.value = employee.responsavel;
        dataAdmissaoInput.value = employee.dataAdmissao;
        
        // Hide the "Criar Usuário" checkbox in edit mode
        criarUsuarioCheckbox.checked = false;
        criarUsuarioCheckbox.parentElement.classList.add('d-none');
        
        isEditMode = true;
        employeeModalLabel.textContent = 'Editar Funcionário';
        employeeModal.show();
    }
}

// Function to fetch employees from API
export async function fetchEmployees() {
    try {
        loadingSpinner.classList.remove('d-none');
        noResults.classList.add('d-none');
        
        // In a real application, you would fetch from the API
        const response = await fetch(URL_LISTAR_FUNCIONARIOS);
        if (!response.ok) throw new Error('Failed to fetch employees');
        const data = await response.json();
        // Armazenar os dados localmente
        employees_local = data;
        
        // For demonstration, we'll use the sample data
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        initializeDataTable(data);
    } catch (error) {
        console.error('Error fetching employees:', error);
        showAlert('Erro ao carregar funcionários. Por favor, tente novamente.', 'danger');
    } finally {
        loadingSpinner.classList.add('d-none');
    }
}

// Function to format date for display
export function formatDateForDisplay(dateString) {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(dateString+"T00:00:00"));
}

// Function to get status badge class
function getStatusBadgeClass(status) {
    switch(status) {
        case "Ativo":
            return "bg-success text-white";
        case "Desativado":
            return "bg-secondary text-white";
        default:
            return "bg-secondary text-white";
    }
}