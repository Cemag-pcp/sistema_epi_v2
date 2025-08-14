// API URL - Replace with your actual API endpoint
import { getCookie, ToastBottomEnd } from "/static/js/scripts.js";
import { initializeDataTable, dataTable } from "./datatable_funcionario.js";

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
    ToastBottomEnd.fire({
        icon: type,
        title: message
    });
}


// Function to add employee to API
async function addEmployee(employeeData) {
    try {
        // Show loading spinner
        saveButtonText.classList.add('d-none');
        saveSpinner.classList.remove('d-none');
        saveEmployeeBtn.disabled = true;
        
        // In a real application, you would post to the API
        const response = await fetch('/funcionario/', {
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

        // Pega o ID do novo funcionário
        const newId = employees.length > 0 ? Math.max(...employees.map(emp => emp.id)) + 1 : 1;

        const newEmployee = { id: newId, ...employeeData };
        employees.push(newEmployee);
        
        // atualização após adicionar um funcionário
        dataTable.clear().rows.add(employees).draw(false);
        employeeModal.hide();
        
        // Return the new employee ID
        return newId;
    } catch (error) {
        console.error('Erro ao adicionar funcionário:', error);
        showAlert(`Erro ao adicionar funcionário.${error.message}`, 'error');
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
        const response = await fetch(`/editar_funcionario/${id}/`, {
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
        // Reconstruir o datatable com os dados atualizados, pois na edição pode haver mudanças no responsável,
        // o que muda o campo de vários funcionarios ao mesmo tempo
        await fetchEmployees();
        
        employeeModal.hide();
        
        return id;
    } catch (error) {
        console.error('Erro ao atualizar funcionário:', error);
        showAlert(`${error.message}`, 'error');
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
        const response = await fetch('/usuario/', {
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
        
        const index = employees.findIndex(emp => emp.id == userData.funcionarioId);
        if (index !== -1) {
            employees[index].usuario = true;
        }
        dataTable.row(index).data(employees[index]).draw(false);

        userModal.hide();
        showAlert('Usuário criado com sucesso!');
        await fetchEmployees();
        
        return true;
    } catch (error) {
        console.error('Error creating user:', error);
        showAlert(`${error.message}`, 'error');
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
        const response = await fetch(`/editar_funcionario/${id}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({ status: 'Desativado' }),
        });
        const data = await response.json();
        
        if (!response.ok){
            errorValidacao(data, 'Falha ao desativar funcionário');
        }
        
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
        showAlert('Erro ao desativar funcionário. Por favor, tente novamente.', 'error');
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
        senhaFeedback.innerText = 'As senhas não correspondem';
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
    const setorSelect = setorInput;
    const cargoSelect = cargoInput;

    let setorPreSelecionado;
    let cargoPreSelecionado;

    matriculaInput.disabled = false;
    nomeInput.disabled = false;
    dataAdmissaoInput.disabled = false;

    if (isEditMode){
        cargoPreSelecionado = cargoInput.value;
        setorPreSelecionado = setorInput.value;

        // Desabilita os campos que não podem ser editados
        matriculaInput.disabled = true;
        nomeInput.disabled = true;
        dataAdmissaoInput.disabled = true;

        if (setorPreSelecionado){
            setorSelect.innerHTML = `<option value="">Selecione o setor</option>
                                <option value="${setorPreSelecionado}" selected>${setorInput.options[setorInput.selectedIndex].textContent}</option>`;
        }else{
            setorSelect.innerHTML = '<option value="">Selecione o setor</option>';
        }

        if (cargoPreSelecionado){
            cargoSelect.innerHTML = `<option value="">Selecione o cargo</option>
                                <option value="${cargoPreSelecionado}" selected>${cargoInput.options[cargoInput.selectedIndex].textContent}</option>`;
        }else{
            cargoSelect.innerHTML = '<option value="">Selecione o cargo</option>';
        }
    }else{
        setorSelect.innerHTML = '<option value="">Carregando setores...</option>';
        cargoSelect.innerHTML = '<option value="">Carregando cargos...</option>';
    }

    fetch('/api_setores/')
        .then(response => {
            if (!response.ok) throw new Error('Erro ao buscar setores');
            return response.json();
        })
        .then(data => {
            if (!isEditMode){
                setorSelect.innerHTML = '<option value="">Selecione o setor</option>';
            }
            
            data.forEach(setor => {
                const optionSetor = document.createElement('option');
                optionSetor.value = setor.id || setor.nome ||  setor;
                if (optionSetor.value !== setorPreSelecionado) {
                    optionSetor.textContent = setor.nome || setor.id || setor;
                    setorSelect.appendChild(optionSetor);
                }else{
                    responsavelInput.value = setor.responsavel__matricula + ' - ' + setor.responsavel__nome;
                }                
            });
        })
        .catch(error => {
            console.error('Erro ao carregar setores:', error.response.status);
            showAlert('Erro ao carregar setores.', 'error');
        });

    fetch('/api_cargos/')
        .then(response => {
            if (!response.ok) throw new Error('Erro ao buscar cargos');
            return response.json();
        })
        .then(data => {
            if (!isEditMode){
                cargoSelect.innerHTML = '<option value="">Selecione o cargo</option>';
            }
            data.forEach(cargo => {
                const optionCargo = document.createElement('option');
                optionCargo.value = cargo.id || cargo;
                if (optionCargo.value !== cargoPreSelecionado) {
                    optionCargo.textContent = cargo.nome || cargo;
                    cargoSelect.appendChild(optionCargo);
                }
            })
        })
});

setorInput.addEventListener('change', function(){
    const setorSelect = setorInput;
    const idSetor = setorSelect.value;

    responsavelInput.value = 'Carregando responsável...';

    if(idSetor){
        fetch(`/api_setores/${idSetor}/`)
        .then(response => {
            if (!response.ok){
                if (!response.status == 404){
                    throw new Error('Erro ao buscar responsável para este Setor!')
                }else{
                    return;
                }
            }
            return response.json();
        })
        .then(data => {
            if (data){
                responsavelInput.value = data.matricula + ' - ' + data.nome;
            }else{
                responsavelInput.value = 'Nenhum responsável encontrado para este setor';
            }
        })
        .catch(error =>{
            console.error(error);
            responsavelInput.value = 'Nenhum responsável encontrado para este setor';
        })
    }else{
        responsavelInput.value = 'Nenhum responsável encontrado para este setor';
    }
})

// Save Employee button click
saveEmployeeBtn.addEventListener('click', async function() {
    if (employeeForm.checkValidity()) {
        const id = employeeIdInput.value;
        
        const employeeData = {
            matricula: matriculaInput.value,
            nome: nomeInput.value,
            cargoId: cargoInput.value,
            setorId: setorInput.value,
            responsavel: responsavelInput.value,
            dataAdmissao: dataAdmissaoInput.value,
            setor: setorInput.options[setorInput.selectedIndex].textContent,
            cargo: cargoInput.options[cargoInput.selectedIndex].textContent,
            tipoAcesso: tipoAcessoInput.value,
            usuario: "",
            hasUsuario: false,
            status: 'Ativo',
        };
        
        try {
            let employeeId;
            
            if (id) {
                // Edit existing employee
                employeeId = await updateEmployee(id, employeeData);
                if (criarUsuarioCheckbox.checked) {
                    tempEmployeeData = {
                        id: employeeId,
                        matricula: employeeData.matricula,
                        nome: employeeData.nome
                    };
                    
                    userForm.reset();
                    userModal.show();
                } else {
                    showAlert('Funcionário editado com sucesso!');
                }
            } else {
                // Add new employee
                employeeId = await addEmployee(employeeData);
                
                if (criarUsuarioCheckbox.checked) {
                    tempEmployeeData = {
                        id: employeeId,
                        matricula: employeeData.matricula,
                        nome: employeeData.nome
                    };
                    
                    userForm.reset();
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

// Reset form
function resetForm() {
    employeeForm.reset();
    employeeIdInput.value = '';
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
    
    showAlert(errorMessage, 'error');
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
        if (!isEditMode){
            showAlert('Funcionário adicionado com sucesso, mas o usuário não foi criado.', 'warning');
        }
        tempEmployeeData = null;
    }
});

// Cancel User button click
cancelUserBtn.addEventListener('click', async function() {
    const result = await Swal.fire({
        icon: 'warning',
        title: 'Confirmação necessária',
        text: 'Tem certeza que deseja cancelar a criação do usuário?',
        showCancelButton: true,
        confirmButtonText: 'Sim, continuar',
        cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
        userModal.hide();
        if (!isEditMode){
            showAlert('Funcionário adicionado com sucesso, mas o usuário não foi criado.', 'warning');
        }
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

    criarUsuarioCheckbox.parentElement.classList.remove('d-none');
    criarUsuarioCheckbox.checked = false;
    
    if (employee) {
        employeeIdInput.value = employee.id;
        matriculaInput.value = employee.matricula;
        nomeInput.value = employee.nome;
        responsavelInput.value = employee.responsavel;
        dataAdmissaoInput.value = employee.dataAdmissao;
        tipoAcessoInput.value = employee.tipoAcesso;

        setorInput.innerHTML="<option value=''>Selecione o Setor</option>";
        const option = document.createElement('option');
        option.value = employee.setorId;
        option.textContent = employee.setor;
        setorInput.appendChild(option);
        setorInput.value = employee.setorId;

        cargoInput.innerHTML="<option value=''>Selecione o Cargo</option>";
        const optionCargo = document.createElement('option');
        optionCargo.value = employee.cargoId;
        optionCargo.textContent = employee.cargo;
        cargoInput.appendChild(optionCargo);
        cargoInput.value = employee.cargoId;

        if (employee.usuario){
            criarUsuarioCheckbox.checked = false;
            criarUsuarioCheckbox.parentElement.classList.add('d-none');
        }
        
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

        const response = await fetch('/api/funcionarios/');
        if (!response.ok) throw new Error('Failed to fetch employees');
        const data = await response.json();
        employees = data.map(employee => ({
            ...employee,
            hasUsuario: employee.hasUsuario
        }));
        initializeDataTable(employees);
    } catch (error) {
        console.error('Error fetching employees:', error);
        showAlert('Erro ao carregar funcionários. Por favor, tente novamente.', 'error');
    } finally {
        loadingSpinner.classList.add('d-none');
    }
}

// Function to handle validation errors
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