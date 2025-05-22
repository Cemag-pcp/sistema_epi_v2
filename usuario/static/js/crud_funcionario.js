// API URL - Replace with your actual API endpoint
import { getCookie } from "/static/js/scripts.js";

console.log('Script loaded');

let employees = [];
// DOM Elements
const employeeTableBody = document.getElementById('employeeTableBody');
const searchInput = document.getElementById('searchInput');
const noResults = document.getElementById('noResults');
const loadingSpinner = document.getElementById('loadingSpinner');
const addEmployeeBtn = document.getElementById('addEmployeeBtn');
const employeeModal = new bootstrap.Modal(document.getElementById('employeeModal'));
const userModal = new bootstrap.Modal(document.getElementById('userModal'));
const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
const employeeForm = document.getElementById('employeeForm');
const userForm = document.getElementById('userForm');
const saveEmployeeBtn = document.getElementById('saveEmployeeBtn');
const saveUserBtn = document.getElementById('saveUserBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const employeeModalLabel = document.getElementById('employeeModalLabel');
const alertContainer = document.getElementById('alertContainer');
const alertMessage = document.getElementById('alertMessage');
const alertText = document.getElementById('alertText');
const saveButtonText = document.getElementById('saveButtonText');
const saveSpinner = document.getElementById('saveSpinner');
const saveUserButtonText = document.getElementById('saveUserButtonText');
const saveUserSpinner = document.getElementById('saveUserSpinner');
const deleteButtonText = document.getElementById('deleteButtonText');
const deleteSpinner = document.getElementById('deleteSpinner');
const criarUsuarioCheckbox = document.getElementById('criarUsuario');
const closeUserModal = document.getElementById('closeUserModal');
const cancelUserBtn = document.getElementById('cancelUserBtn');

// Form fields
const employeeIdInput = document.getElementById('employeeId');
const matriculaInput = document.getElementById('matricula');
const nomeInput = document.getElementById('nome');
const cargoInput = document.getElementById('cargo');
const setorInput = document.getElementById('setor');
const responsavelInput = document.getElementById('responsavel');
const dataAdmissaoInput = document.getElementById('dataAdmissao');
const senhaInput = document.getElementById('senha');
const confirmarSenhaInput = document.getElementById('confirmarSenha');
const tipoAcessoInput = document.getElementById('tipoAcesso');
const senhaFeedback = document.getElementById('senhaFeedback');

// Variables to store temporary data
let tempEmployeeData = null;
let isEditMode = false;

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
    return new Intl.DateTimeFormat('pt-BR').format(new Date(dateString+"T00:00:00"));
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
        const response = await fetch(URL_LISTAR_FUNCIONARIOS);
        if (!response.ok) throw new Error('Failed to fetch employees');
        const data = await response.json();
        employees = data;
        
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
        
        // Return the new employee ID
        return newId;
    } catch (error) {
        console.error('Error adding employee:', error);
        showAlert('Erro ao adicionar funcionário. Por favor, tente novamente.', 'danger');
        throw error;
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
        
        return id;
    } catch (error) {
        console.error('Error updating employee:', error);
        showAlert('Erro ao atualizar funcionário. Por favor, tente novamente.', 'danger');
        throw error;
    } finally {
        // Hide loading spinner
        saveButtonText.classList.remove('d-none');
        saveSpinner.classList.add('d-none');
    }
}

// Function to create user in API
async function createUser(userData) {
    try {
        // Show loading spinner
        saveUserButtonText.classList.add('d-none');
        saveUserSpinner.classList.remove('d-none');
        
        // In a real application, you would post to the API
        // const response = await fetch(USER_API_URL, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //     },
        //     body: JSON.stringify(userData),
        // });
        // if (!response.ok) throw new Error('Failed to create user');
        // const data = await response.json();
        
        // For demonstration, we'll simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        userModal.hide();
        showAlert('Usuário criado com sucesso!');
        
        return true;
    } catch (error) {
        console.error('Error creating user:', error);
        showAlert('Erro ao criar usuário. Por favor, tente novamente.', 'danger');
        throw error;
    } finally {
        // Hide loading spinner
        saveUserButtonText.classList.remove('d-none');
        saveUserSpinner.classList.add('d-none');
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

// Function to validate password match
function validatePasswordMatch() {
    const senha = senhaInput.value;
    const confirmarSenha = confirmarSenhaInput.value;
    
    if (confirmarSenha === '') {
        // If empty, don't show error yet
        confirmarSenhaInput.classList.remove('is-invalid');
        return false;
    }
    
    if (senha === confirmarSenha) {
        confirmarSenhaInput.classList.remove('is-invalid');
        return true;
    } else {
        confirmarSenhaInput.classList.add('is-invalid');
        return false;
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
    isEditMode = false;
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
        };
        
        try {
            let employeeId;
            
            if (id) {
                // Edit existing employee
                employeeId = await updateEmployee(id, employeeData);
                showAlert('Funcionário atualizado com sucesso!');
            } else {
                // Add new employee
                employeeId = await addEmployee(employeeData);
                
                // Check if user creation is requested
                if (criarUsuarioCheckbox.checked) {
                    // Store employee data temporarily
                    tempEmployeeData = {
                        id: employeeId,
                        matricula: employeeData.matricula,
                        nome: employeeData.nome
                    };
                    
                    // Reset user form
                    userForm.reset();
                    
                    // Show user creation modal
                    userModal.show();
                } else {
                    showAlert('Funcionário adicionado com sucesso!');
                }
            }
        } catch (error) {
            // Error is already handled in the respective functions
        }
    } else {
        employeeForm.reportValidity();
    }
});

// Password confirmation validation
confirmarSenhaInput.addEventListener('input', validatePasswordMatch);
senhaInput.addEventListener('input', function() {
    if (confirmarSenhaInput.value !== '') {
        validatePasswordMatch();
    }
});

// Save User button click
saveUserBtn.addEventListener('click', async function() {
    // First check if passwords match
    const passwordsMatch = validatePasswordMatch();
    
    if (!passwordsMatch) {
        confirmarSenhaInput.classList.add('is-invalid');
        return;
    }
    
    if (userForm.checkValidity()) {
        try {
            const userData = {
                funcionarioId: tempEmployeeData.id,
                matricula: tempEmployeeData.matricula,
                nome: tempEmployeeData.nome,
                senha: senhaInput.value,
                tipoAcesso: tipoAcessoInput.value
            };
            
            await createUser(userData);
            tempEmployeeData = null;
        } catch (error) {
            // Error is already handled in createUser function
        }
    } else {
        userForm.reportValidity();
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
        
        // Hide the "Criar Usuário" checkbox in edit mode
        criarUsuarioCheckbox.checked = false;
        criarUsuarioCheckbox.parentElement.classList.add('d-none');
        
        isEditMode = true;
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

// Close User Modal button click
closeUserModal.addEventListener('click', function() {
    const confirmClose = confirm("Tem certeza que deseja cancelar a criação do usuário?");
    if (confirmClose) {
        userModal.hide();
        showAlert('Funcionário adicionado com sucesso, mas o usuário não foi criado.', 'warning');
        tempEmployeeData = null;
    }
});

// Cancel User button click
cancelUserBtn.addEventListener('click', function() {
    const confirmCancel = confirm("Tem certeza que deseja cancelar a criação do usuário?");
    if (confirmCancel) {
        userModal.hide();
        showAlert('Funcionário adicionado com sucesso, mas o usuário não foi criado.', 'warning');
        tempEmployeeData = null;
    }
});

// Reset form
function resetForm() {
    employeeForm.reset();
    employeeIdInput.value = '';
    
    // Show the "Criar Usuário" checkbox for new employees
    criarUsuarioCheckbox.parentElement.classList.remove('d-none');
}

// Initial fetch
fetchEmployees();
