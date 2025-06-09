import { getCookie } from "/static/js/scripts.js";


// DOM Elements
const loadingSpinner = document.getElementById('loadingSpinner');
const editSetorModalElement = document.getElementById('editSetorModal'); // Get the element
const editSetorModal = new bootstrap.Modal(editSetorModalElement); // Initialize Bootstrap modal
const editSetorForm = document.getElementById('editSetorForm');
const saveSetorBtn = document.getElementById('saveSetorBtn');
const alertContainer = document.getElementById('alertContainer');
const alertMessage = document.getElementById('alertMessage');
const alertText = document.getElementById('alertText');
const saveButtonText = document.getElementById('saveButtonText');
const saveSpinner = document.getElementById('saveSpinner');
const erroMessage = document.getElementById('erro-modal');

// Form fields
const setorIdInput = document.getElementById('setorId');
const nomeSetorInput = document.getElementById('nomeSetor');
const responsavelSetorInput = document.getElementById('responsavelSetor');

// DataTable variable
let setorDataTable = null;
let setorDataLocal;
let usuariosData;

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

// Function to initialize DataTable
function initializeSetorDataTable(data) {
    // Destroy existing DataTable if it exists
    if (setorDataTable) {
        setorDataTable.destroy();
    }
    
    // Initialize DataTable
    setorDataTable = $('#setorTable').DataTable({
        data: data,
        columns: [
            { 
                data: 'nome',
                render: function(data, type, row) {
                    if (type === 'display') {
                        return `
                            <div class="d-flex align-items-center">
                                <div class="profile-img me-2">
                                    <i class="bi bi-building"></i>
                                </div>
                                <span class="fw-bold">${data}</span>
                            </div>
                        `;
                    }
                    return data;
                }
            },
            { 
                data: 'responsavel__nome',
                render: function(data, type, row) {
                    if (type === 'display') {
                        return `
                            <div class="d-flex align-items-center">
                                <div class="profile-img me-2">
                                    <i class="bi bi-person-badge"></i>
                                </div>
                                <span>${data}</span>
                            </div>
                        `;
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
                        <button class="btn btn-outline-primary btn-sm edit-btn" data-id="${data}" data-setor="${row.nome}" data-responsavel-id="${row.responsavel_id}"
                        data-responsavel-nome="${row.responsavel__nome}" data-responsavel-matricula="${row.responsavel__matricula}">
                            <i class="bi bi-pencil me-1"></i>Editar Setor
                        </button>
                    `;
                }
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json',
        },
        responsive: true,
        lengthMenu: [[5, 10, 25, 50, -1], [5, 10, 25, 50, "Todos"]],
        pageLength: 10,
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rtip',
        order: [[0, 'asc']], // Order by setor name by default
        initComplete: function() {
            // Add event listeners to edit buttons
            $('#setorTable').on('click', '.edit-btn', handleEditClick);
        }
    });
    
    // Custom search functionality for DataTable
    $('#searchInput').on('keyup', function() {
        setorDataTable.search(this.value).draw();
    });
}

// Function to fetch setores from API
async function fetchSetores() {
    try {
        loadingSpinner.classList.remove('d-none');
        
        // In a real application, you would fetch from the API
        const response = await fetch(URL_API_SETORES);
        if (!response.ok) throw new Error('Failed to fetch setores');
        const data = await response.json();
        setorDataLocal = data;
        // For demonstration, we'll use the sample data
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        initializeSetorDataTable(data);
    } catch (error) {
        console.error('Error fetching setores:', error);
        showAlert('Erro ao carregar setores. Por favor, tente novamente.', 'danger');
    } finally {
        loadingSpinner.classList.add('d-none');
    }
}

// Function to update setor responsavel in API
async function updateSetorResponsavel(id, responsavel, forcar=false) {
    try {
        // Show loading spinner
        saveButtonText.classList.add('d-none');
        saveSpinner.classList.remove('d-none');
        saveSetorBtn.disabled = true;
        
        // In a real application, you would send PUT request to the API
        const response = await fetch(`${URL_EDITAR_SETOR}${id}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({ responsavel: parseInt(responsavel), setores: setorDataLocal, forcar:forcar }),
        });
        const updatedSetor = await response.json();

        if (!response.ok){
            const errorMessage = updatedSetor.message || 'Erro ao atualizar responsável.';
            if (errorMessage.includes('já é responsável de outro setor')) {
            const result = await Swal.fire({
                icon: 'warning',
                title: 'Confirmação necessária',
                text: errorMessage + ' O setor deste responsável ficará sem responsável! Deseja continuar mesmo assim?',
                showCancelButton: true,
                confirmButtonText: 'Sim, continuar',
                cancelButtonText: 'Cancelar'
            });
            if (result.isConfirmed) {
                // Reenvia a requisição com um sinalizador (ex: forçar)
                return await updateSetorResponsavel(id, responsavel, true);
            } else {
                return; // Usuário cancelou
            }
        }
        }
        // Se for o erro específico que deve permitir confirmação:
        
        
        // For demonstration, we'll update the sample data
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const index = setorDataLocal.findIndex(setor => setor.id == id);
        if (index !== -1) {
            setorDataLocal[index].responsavel__nome = updatedSetor.responsavel.nome;
            setorDataLocal[index].responsavel_id = updatedSetor.responsavel.id;
            setorDataLocal[index].responsavel__matricula = updatedSetor.responsavel.matricula;
        }

        setorDataTable.row(index).data(setorDataLocal[index]).draw(false);
        
        let indexSetorVazio;

        if (updatedSetor.responsavel.setorVazio){
            indexSetorVazio = setorDataLocal.findIndex(setor => setor.id == updatedSetor.responsavel.setorVazio);
            if (indexSetorVazio !== -1){
                setorDataLocal[indexSetorVazio].responsavel__nome = '--';
                setorDataLocal[indexSetorVazio].responsavel_id = '';
                setorDataLocal[indexSetorVazio].responsavel__matricula = '';
            }
            setorDataTable.row(indexSetorVazio).data(setorDataLocal[indexSetorVazio]).draw(false);
        }
        
        
        // Altera a linha do setor editado
        // setorDataTable.clear().rows.add(setorDataLocal).draw();
        
        
        
        editSetorModal.hide();
        showAlert('Responsável do setor atualizado com sucesso!');
        
        return id;
    } catch (error) {
        handleApiError(error, `${error.message}`);
        mostrarErroModal(`${error.message}`);
        throw error;
    } finally {
        // Hide loading spinner
        saveButtonText.classList.remove('d-none');
        saveSpinner.classList.add('d-none');
        saveSetorBtn.disabled = false;
    }
}

// Handle Edit button click
function handleEditClick(e) {
    e.preventDefault();

    esconderErroModal();

    const button = e.currentTarget;
    const id = button.dataset.id;
    const setor = button.dataset.setor;
    const responsavelId = button.dataset.responsavelId;
    // const responsavelNome = button.dataset.responsavelNome;
    // const responsavelMatricula = button.dataset.responsavelMatricula;
    
    
    responsavelSetorInput.innerHTML = "<option value=''>Selecione o responsável</option>";

    // Fill the form with current data

    usuariosData.forEach(usuario => {
        const optionResponsavel = document.createElement('option');

        //criando option do setor do funcionario
        optionResponsavel.value = usuario.funcionario__id || ""; // Use setorId if available, otherwise fallback to setor
        optionResponsavel.textContent = (usuario.funcionario__matricula && usuario.funcionario__nome)
                                        ? usuario.funcionario__matricula + ' - ' + usuario.funcionario__nome
                                        : 'Responsável Desconhecido'; // Fallback to setorNome or a default text

        responsavelSetorInput.appendChild(optionResponsavel);

        if (optionResponsavel.value === responsavelId){
            optionResponsavel.selected = true;
        }
    });
    setorIdInput.value = id;
    nomeSetorInput.value = setor;

    
    // Show the modal
    editSetorModal.show();
}

// Save Setor button click
saveSetorBtn.addEventListener('click', async function() {
    if (editSetorForm.checkValidity()) {
        const id = setorIdInput.value;
        const responsavel = responsavelSetorInput.value;
        
        if (!responsavel) {
            showAlert('Por favor, informe o responsável.', 'warning');
            return;
        }
        
        try {
            await updateSetorResponsavel(id, responsavel);
        } catch (error) {
            // Error is already handled in updateSetorResponsavel function
        }
    } else {
        editSetorForm.reportValidity();
    }
});

// Form validation and formatting
responsavelSetorInput.addEventListener('input', function() {
    // Convert to title case
    this.value = this.value.replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
});

// Prevent form submission on Enter key
editSetorForm.addEventListener('submit', function(e) {
    e.preventDefault();
    saveSetorBtn.click();
});

// Function to fetch setores from API
async function fetchUsuarios() {
    try {
        // loadingSpinner.classList.remove('d-none');
        // In a real application, you would fetch from the API
        const response = await fetch(URL_API_USUARIOS);
        if (!response.ok) throw new Error('Failed to fetch usuarios');
        const data =  await response.json();
        usuariosData = data;
        // For demonstration, we'll use the sample data
        // Simulate API delay
        
        // initializeSetorDataTable(data);
    } catch (error) {
        console.error('Error fetching usuarios:', error);
        showAlert('Erro ao carregar usuarios. Por favor, tente novamente.', 'danger');
    } finally {
        console.log('Carregando usuarios');
        // loadingSpinner.classList.add('d-none');
    }
}

function mostrarErroModal(mensagem) {
    erroMessage.classList.remove('d-none'); // mostra a div
    erroMessage.innerText = mensagem;       // insere o texto
}

function esconderErroModal() {
    erroMessage.classList.add('d-none'); // mostra a div
    erroMessage.innerText = ''; 
}

// Initial fetch when document is ready
$(document).ready(function() {
    fetchSetores();
    fetchUsuarios();
});