// API URL - Replace with your actual API endpoint
import { getCookie } from "/static/js/scripts.js";
import { initializeDataTable, dataTable } from "./datatable_funcionario.js";

console.log('Script loaded');

export let employees = [];
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
const erroMessage = document.getElementById('erro-modal');

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
export function showAlert(message, type = 'success') {
    alertText.textContent = message;
    alertMessage.className = `alert alert-${type} alert-dismissible fade show`;
    alertContainer.classList.remove('d-none');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        alertContainer.classList.add('d-none');
    }, 5000);
}


// Function to add employee to API
async function addEmployee(employeeData) {
    try {
        // Show loading spinner
        saveButtonText.classList.add('d-none');
        saveSpinner.classList.remove('d-none');
        saveEmployeeBtn.disabled = true;
        
        // In a real application, you would post to the API
        const response = await fetch(URL_CADASTRAR_FUNCIONARIO, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify(employeeData),
        });
        const data = await response.json();

        if (!response.ok){
            errorValidacao(data, 'Falha ao adicionar funcionário');
        }

        // For demonstration, we'll add to the sample data
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newId = employees.length > 0 ? Math.max(...employees.map(emp => emp.id)) + 1 : 1;
        //Trocando o valor do id do setor para o nome
        employeeData['setor'] = employeeData['setorNome'];
        const newEmployee = { id: newId, ...employeeData };
        employees.push(newEmployee);
        
        // renderEmployees(employees);
        // Exemplo de atualização após adicionar um funcionário
        dataTable.clear().rows.add(employees).draw(false);
        employeeModal.hide();
        
        // Return the new employee ID
        return newId;
    } catch (error) {
        console.error('Erro ao adicionar funcionário:', error);
        showAlert(`Erro ao adicionar funcionário.${error.message}`, 'danger');
        mostrarErroModal(`${error.message}`);
        throw error;
    } finally {
        // Hide loading spinner
        saveButtonText.classList.remove('d-none');
        saveSpinner.classList.add('d-none');
        saveEmployeeBtn.disabled = false;
    }
}

// Function to update employee in API
async function updateEmployee(id, employeeData) {
    try {
        // Show loading spinner
        saveButtonText.classList.add('d-none');
        saveSpinner.classList.remove('d-none');
        saveEmployeeBtn.disabled = true;
        
        // In a real application, you would put to the API
        const response = await fetch(`${URL_EDITAR_FUNCIONARIO}${id}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify(employeeData),
        });
        
        const data = await response.json();

        if (!response.ok){
            errorValidacao(data, 'Falha ao atualizar funcionário');
        }


        // For demonstration, we'll update the sample data
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        employeeData['setor'] = employeeData['setorNome'];
        // Atualizar o datatable sem reinicializar
        const index = employees.findIndex(emp => emp.id == id);
        if (index !== -1) {
            employees[index] = { ...employees[index], ...employeeData };
        }
        // Refresh the DataTable
        dataTable.row(index).data(employees[index]).draw(false);
        employeeModal.hide();
        
        return id;
    } catch (error) {
        console.error('Erro ao atualizar funcionário:', error);
        showAlert(`${error.message}`, 'danger');
        mostrarErroModal(`${error.message}`);
        throw error;
    } finally {
        // Hide loading spinner
        saveButtonText.classList.remove('d-none');
        saveSpinner.classList.add('d-none');
        saveEmployeeBtn.disabled = false;

    }
}

// Function to create user in API
async function createUser(userData) {
    try {
        // Show loading spinner
        saveUserButtonText.classList.add('d-none');
        saveUserSpinner.classList.remove('d-none');
        saveUserBtn.disabled = true;
        
        // In a real application, you would post to the API
        const response = await fetch(URL_CADASTRAR_USUARIO, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify(userData),
        });
        const data = await response.json();
        if (!response.ok){
            errorValidacao(data, 'Falha ao criar usuário');
        }
        
        // For demonstration, we'll simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        userModal.hide();
        showAlert('Usuário criado com sucesso!');
        
        return true;
    } catch (error) {
        console.error('Error creating user:', error);
        showAlert(`${error.message}`, 'danger');
        mostrarErroModal(`${error.message}`);
        throw error;
    } finally {
        // Hide loading spinner
        saveUserButtonText.classList.remove('d-none');
        saveUserSpinner.classList.add('d-none');
        saveUserBtn.disabled = false;

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
        console.log('Response data:', response);
        const data = await response.json();
        
        if (!response.ok){
            errorValidacao(data, 'Falha ao desativar funcionário');
        }
        
        // For demonstration, we'll update the sample data
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Atualizar o datatable sem reinicializar
        const index = employees.findIndex(emp => emp.id == id);
        if (index !== -1) {
            employees[index].status = 'Desativado';
        }
        dataTable.row(index).data(employees[index]).draw(false);
        
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

// Add New Employee button click
addEmployeeBtn.addEventListener('click', function() {
    resetForm();
    isEditMode = false;
    employeeModalLabel.textContent = 'Adicionar Funcionário';
    employeeModal.show();
});

document.getElementById('employeeModal').addEventListener('show.bs.modal', function() {

    // Limpa a mensagem de erro do modal
    esconderErroModal();

    console.log(isEditMode);

    const setorSelect = setorInput; // setorInput já é o select
    let setorPreSelecionado;
    // Limpa o select antes de preencher
    if (isEditMode){
        setorPreSelecionado = setorInput.value;
        console.log('Setor pré-selecionado:', setorPreSelecionado);
        setorSelect.innerHTML = `<option value="">Selecione o setor</option>
                                <option value="${setorPreSelecionado}" selected>${setorInput.options[setorInput.selectedIndex].textContent}</option>`;
    }else{
        setorSelect.innerHTML = '<option value="">Carregando setores...</option>';
    }
    

    fetch('/setores/')
        .then(response => {
            if (!response.ok) throw new Error('Erro ao buscar setores');
            return response.json();
        })
        .then(data => {
            if (!isEditMode){
                setorSelect.innerHTML = '<option value="">Selecione o setor</option>';
            }
            
            data.forEach(setor => {
                const option = document.createElement('option');
                option.value = setor.id || setor.nome ||  setor; // ajuste conforme o retorno da sua API
                if (option.value === setorPreSelecionado) {
                    // option.selected = true; // Marca o setor pré-selecionado
                    return;
                }
                option.textContent = setor.nome || setor.id || setor;
                setorSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar setores:', error);
            showAlert('Erro ao carregar setores.', 'danger');
        });
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
            setorNome: setorInput.options[setorInput.selectedIndex].textContent,
            status: 'Ativo',
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

function mostrarErroModal(mensagem) {
    erroMessage.classList.remove('d-none'); // mostra a div
    erroMessage.innerText = mensagem;       // insere o texto
}

function esconderErroModal() {
    erroMessage.classList.add('d-none'); // mostra a div
    erroMessage.innerText = ''; 
}

// Reset form
function resetForm() {
    employeeForm.reset();
    employeeIdInput.value = '';
    
    // Show the "Criar Usuário" checkbox for new employees
    criarUsuarioCheckbox.parentElement.classList.remove('d-none');
}

// Function to handle API errors
function handleApiError(error, defaultMessage) {
    console.error(error);
    
    let errorMessage = defaultMessage;
    
    if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
    } else if (error.message) {
        errorMessage = error.message;
    }
    
    showAlert(errorMessage, 'danger');
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

// Custom search functionality for DataTable
$('#searchInput').on('keyup', function() {
    dataTable.search(this.value).draw();
});

// Initial fetch
$(document).ready(function() {
    fetchEmployees();
});

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
        responsavelInput.value = employee.responsavel;
        dataAdmissaoInput.value = employee.dataAdmissao;

        //criando option do setor do funcionario
        const option = document.createElement('option');
        option.value = employee.setorId || employee.setor; // Use setorId if available, otherwise fallback to setor
        option.textContent = employee.setor || employee.setorNome || 'Setor Desconhecido'; // Fallback to setorNome or a default text
        setorInput.appendChild(option);

        setorInput.value = employee.setorId;
        
        console.log('Editing employee:', employee);

        // Hide the "Criar Usuário" checkbox in edit mode
        // criarUsuarioCheckbox.checked = false;
        // criarUsuarioCheckbox.parentElement.classList.add('d-none');
        
        isEditMode = true;
        employeeModalLabel.textContent = 'Editar Funcionário';
        employeeModal.show();
    }
}

// Handle Delete button click
export function handleDeleteClick(e) {
    e.preventDefault();
    const id = e.target.dataset.id;
    
    confirmDeleteBtn.dataset.id = id;
    deleteModal.show();
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
        employees = data;
        
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

function errorValidacao(data, error) {
        if (data.errors) {
            let errorMessage;
            for (const erro in data.errors){
                errorMessage = data.errors[erro];
            }
            throw new Error(`${errorMessage}`);
        } else{
            throw new Error(error);
        }
}


