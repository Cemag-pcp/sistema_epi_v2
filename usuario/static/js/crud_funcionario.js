// API URL - Replace with your actual API endpoint
import { getCookie } from "/static/js/scripts.js";

console.log('Script loaded');
const API_URL = 'https://api.example.com/funcionarios';

// Sample employee data (for demonstration purposes)
let employees = [
    {
        id: 1,
        matricula: "F001",
        nome: "João Silva",
        cargo: "Desenvolvedor Sênior",
        setor: "Engenharia",
        responsavel: "Carlos Mendes",
        dataAdmissao: "2020-05-12",
        status: "Ativo"
    },
    {
        id: 2,
        matricula: "F002",
        nome: "Maria Oliveira",
        cargo: "Gerente de Produto",
        setor: "Produto",
        responsavel: "Ana Souza",
        dataAdmissao: "2019-11-18",
        status: "Ativo"
    },
    {
        id: 3,
        matricula: "F003",
        nome: "Pedro Santos",
        cargo: "Designer UX",
        setor: "Design",
        responsavel: "Fernanda Lima",
        dataAdmissao: "2021-02-03",
        status: "Afastado"
    },
    {
        id: 4,
        matricula: "F004",
        nome: "Ana Costa",
        cargo: "Especialista de Marketing",
        setor: "Marketing",
        responsavel: "Roberto Alves",
        dataAdmissao: "2018-07-22",
        status: "Desligado"
    },
    {
        id: 5,
        matricula: "F005",
        nome: "Roberto Almeida",
        cargo: "Gerente de RH",
        setor: "Recursos Humanos",
        responsavel: "Carla Ferreira",
        dataAdmissao: "2017-09-15",
        status: "Ativo"
    }
];

// DOM Elements
const employeeTableBody = document.getElementById('employeeTableBody');
const searchInput = document.getElementById('searchInput');
const noResults = document.getElementById('noResults');
const loadingSpinner = document.getElementById('loadingSpinner');
const addEmployeeBtn = document.getElementById('addEmployeeBtn');
const employeeModal = new bootstrap.Modal(document.getElementById('employeeModal'));
const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
const employeeForm = document.getElementById('employeeForm');
const saveEmployeeBtn = document.getElementById('saveEmployeeBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const employeeModalLabel = document.getElementById('employeeModalLabel');
const alertContainer = document.getElementById('alertContainer');
const alertMessage = document.getElementById('alertMessage');
const alertText = document.getElementById('alertText');
const saveButtonText = document.getElementById('saveButtonText');
const saveSpinner = document.getElementById('saveSpinner');
const deleteButtonText = document.getElementById('deleteButtonText');
const deleteSpinner = document.getElementById('deleteSpinner');

// Form fields
const employeeIdInput = document.getElementById('employeeId');
const matriculaInput = document.getElementById('matricula');
const nomeInput = document.getElementById('nome');
const cargoInput = document.getElementById('cargo');
const setorInput = document.getElementById('setor');
const responsavelInput = document.getElementById('responsavel');
const dataAdmissaoInput = document.getElementById('dataAdmissao');
const statusInput = document.getElementById('status');

// Function to show alert
function showAlert(message, type = 'success') {
    alertText.textContent = message;
    alertMessage.className = `alert alert-${type} alert-dismissible fade show`;
    alertContainer.classList.remove('d-none');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        alertContainer.classList.add('d-none');
    }, 5000);
}

// Function to get status badge class
function getStatusBadgeClass(status) {
    switch(status) {
        case "Ativo":
            return "bg-success text-white";
        case "Desligado":
            return "bg-danger text-white";
        case "Afastado":
            return "bg-warning text-dark";
        case "Desativado":
            return "bg-secondary text-white";
        default:
            return "bg-secondary text-white";
    }
}

// Function to format date for display
function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Function to render employees
function renderEmployees(employeesToRender) {
    employeeTableBody.innerHTML = '';
    
    if (employeesToRender.length === 0) {
        noResults.classList.remove('d-none');
    } else {
        noResults.classList.add('d-none');
        
        employeesToRender.forEach(employee => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${employee.matricula}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="bg-light rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 40px; height: 40px;">
                            <i class="bi bi-person"></i>
                        </div>
                        <span class="fw-bold">${employee.nome}</span>
                    </div>
                </td>
                <td>${employee.setor}</td>
                <td>${employee.cargo}</td>
                <td>${employee.responsavel}</td>
                <td>${formatDateForDisplay(employee.dataAdmissao)}</td>
                <td>
                    <span class="badge rounded-pill ${getStatusBadgeClass(employee.status)}">${employee.status}</span>
                </td>
                <td>
                    <div class="dropdown">
                        <button class="btn btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item edit-btn" href="#" data-id="${employee.id}">Editar</a></li>
                            <li><a class="dropdown-item delete-btn" href="#" data-id="${employee.id}">Desativar</a></li>
                        </ul>
                    </div>
                </td>
            `;
            
            employeeTableBody.appendChild(row);
        });

        // Add event listeners to edit and delete buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', handleEditClick);
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteClick);
        });
    }
}

// Function to fetch employees from API
async function fetchEmployees() {
    try {
        loadingSpinner.classList.remove('d-none');
        noResults.classList.add('d-none');
        
        // In a real application, you would fetch from the API
        // const response = await fetch(API_URL);
        // if (!response.ok) throw new Error('Failed to fetch employees');
        // const data = await response.json();
        // employees = data;
        
        // For demonstration, we'll use the sample data
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        renderEmployees(employees);
    } catch (error) {
        console.error('Error fetching employees:', error);
        showAlert('Erro ao carregar funcionários. Por favor, tente novamente.', 'danger');
    } finally {
        loadingSpinner.classList.add('d-none');
    }
}

// Function to add employee to API
async function addEmployee(employeeData) {
    try {
        // Show loading spinner
        saveButtonText.classList.add('d-none');
        saveSpinner.classList.remove('d-none');

        
        // In a real application, you would post to the API
        const response = await fetch(URL_CADASTRAR_FUNCIONARIO, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify(employeeData),
        });
        if (!response.ok) throw new Error('Failed to add employee');
        const data = await response.json();
        
        // For demonstration, we'll add to the sample data
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newId = employees.length > 0 ? Math.max(...employees.map(emp => emp.id)) + 1 : 1;
        const newEmployee = { id: newId, ...employeeData };
        employees.push(newEmployee);
        
        renderEmployees(employees);
        employeeModal.hide();
        showAlert('Funcionário adicionado com sucesso!');
    } catch (error) {
        console.error('Error adding employee:', error);
        showAlert('Erro ao adicionar funcionário. Por favor, tente novamente.', 'danger');
    } finally {
        // Hide loading spinner
        saveButtonText.classList.remove('d-none');
        saveSpinner.classList.add('d-none');
    }
}

// Function to update employee in API
async function updateEmployee(id, employeeData) {
    try {
        // Show loading spinner
        saveButtonText.classList.add('d-none');
        saveSpinner.classList.remove('d-none');
        
        // In a real application, you would put to the API
        const response = await fetch(`${URL_EDITAR_FUNCIONARIO}${id}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify(employeeData),
        });
        if (!response.ok) throw new Error('Failed to update employee');
        const data = await response.json();
        
        // For demonstration, we'll update the sample data
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const index = employees.findIndex(emp => emp.id == id);
        if (index !== -1) {
            employees[index] = { ...employees[index], ...employeeData };
        }
        
        renderEmployees(employees);
        employeeModal.hide();
        showAlert('Funcionário atualizado com sucesso!');
    } catch (error) {
        console.error('Error updating employee:', error);
        showAlert('Erro ao atualizar funcionário. Por favor, tente novamente.', 'danger');
    } finally {
        // Hide loading spinner
        saveButtonText.classList.remove('d-none');
        saveSpinner.classList.add('d-none');
    }
}

// Function to deactivate employee in API
async function deactivateEmployee(id) {
    try {
        // Show loading spinner
        deleteButtonText.classList.add('d-none');
        deleteSpinner.classList.remove('d-none');
        
        // In a real application, you would patch to the API
        const response = await fetch(`${URL_DESATIVAR_FUNCIONARIO}${id}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({ status: 'Desativado' }),
        });
        if (!response.ok) throw new Error('Failed to deactivate employee');
        
        // For demonstration, we'll update the sample data
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const index = employees.findIndex(emp => emp.id == id);
        if (index !== -1) {
            employees[index].status = 'Desativado';
        }
        
        renderEmployees(employees);
        deleteModal.hide();
        showAlert('Funcionário desativado com sucesso!');
    } catch (error) {
        console.error('Error deactivating employee:', error);
        showAlert('Erro ao desativar funcionário. Por favor, tente novamente.', 'danger');
    } finally {
        // Hide loading spinner
        deleteButtonText.classList.remove('d-none');
        deleteSpinner.classList.add('d-none');
    }
}

// Search functionality
searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const filteredEmployees = employees.filter(employee => 
        employee.matricula.toLowerCase().includes(searchTerm) ||
        employee.nome.toLowerCase().includes(searchTerm) ||
        employee.cargo.toLowerCase().includes(searchTerm) ||
        employee.setor.toLowerCase().includes(searchTerm) ||
        employee.responsavel.toLowerCase().includes(searchTerm)
    );
    renderEmployees(filteredEmployees);
});

// Add New Employee button click
addEmployeeBtn.addEventListener('click', function() {
    resetForm();
    employeeModalLabel.textContent = 'Adicionar Funcionário';
    employeeModal.show();
});

// Save Employee button click
saveEmployeeBtn.addEventListener('click', async function() {
    if (employeeForm.checkValidity()) {
        const id = employeeIdInput.value;
        
        const employeeData = {
            matricula: matriculaInput.value,
            nome: nomeInput.value,
            cargo: cargoInput.value,
            setor: setorInput.value,
            responsavel: responsavelInput.value,
            dataAdmissao: dataAdmissaoInput.value,
            // status: 'Ativo'
        };
        
        if (id) {
            // Edit existing employee
            await updateEmployee(id, employeeData);
        } else {
            // Add new employee
            await addEmployee(employeeData);
        }
    } else {
        employeeForm.reportValidity();
    }
});

// Handle Edit button click
function handleEditClick(e) {
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
        // statusInput.value = employee.status;
        
        employeeModalLabel.textContent = 'Editar Funcionário';
        employeeModal.show();
    }
}

// Handle Delete button click
function handleDeleteClick(e) {
    e.preventDefault();
    const id = e.target.dataset.id;
    
    confirmDeleteBtn.dataset.id = id;
    deleteModal.show();
}

// Confirm Delete button click
confirmDeleteBtn.addEventListener('click', async function() {
    const id = this.dataset.id;
    await deactivateEmployee(id);
});

// Reset form
function resetForm() {
    employeeForm.reset();
    employeeIdInput.value = '';
}

// Initial fetch
fetchEmployees();