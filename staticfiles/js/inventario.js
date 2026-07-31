let idFuncionario = document.getElementById('funcionario-id');
let tipoAcesso = document.getElementById('funcionario-tipo-acesso');

async function fetchActiveItems(idFuncionario){
    // if (idFuncionario.textContent !== "") {
    //     console.error('User ID not found');
    //     return [];
    // }
    try {
        showPPELoadingState();

        const response = await fetch(`/api_itens_ativos/${idFuncionario}/`);
        if (!response.ok) {
            // throw new Error('Network response was not ok');
            if (response.status === 404) {
                // Operator has no PPE items
                hidePPELoadingState();
                showNoItemsState();
                return [];
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        hidePPELoadingState();
        return data;

    } catch (error) {
        console.error('Error fetching active items:', error);
        hidePPELoadingState();
        return [];
    }
}


let operators = [];
let itemConditions = {};

// State variables
let selectedOperator = "";

// UI State Management Functions
function showPPELoadingState() {
    document.getElementById('ppeLoadingState').style.display = 'block';
    document.getElementById('ppeLoadingSpinner').style.display = 'inline-block';
    document.getElementById('ppeTableContainer').style.display = 'none';
    document.getElementById('ppeErrorState').style.display = 'none';
    document.getElementById('noItemsState').style.display = 'none';
}

function hidePPELoadingState() {
    document.getElementById('ppeLoadingState').style.display = 'none';
    document.getElementById('ppeLoadingSpinner').style.display = 'none';
}

function showPPEErrorState(error) {
    const errorMessage = error.name === 'AbortError' 
        ? 'Request timed out. Please check your connection.'
        : 'Failed to load PPE items. Please try again.';
    
    document.getElementById('ppeErrorMessage').textContent = errorMessage;
    document.getElementById('ppeErrorState').style.display = 'block';
    document.getElementById('ppeTableContainer').style.display = 'none';
    document.getElementById('noItemsState').style.display = 'none';
}

function showNoItemsState() {
    document.getElementById('noItemsState').style.display = 'block';
    document.getElementById('ppeTableContainer').style.display = 'none';
    document.getElementById('ppeErrorState').style.display = 'none';
}

function showPPEItemsTable() {
    document.getElementById('ppeTableContainer').style.display = 'block';
    document.getElementById('ppeErrorState').style.display = 'none';
    document.getElementById('noItemsState').style.display = 'none';
}


// Initialize page
async function initializePage() {
    if (idFuncionario.textContent != "" && tipoAcesso.textContent != ""){
        idFuncionario = parseInt(idFuncionario.textContent);
        tipoAcesso = tipoAcesso.textContent.trim();
    }else{
        idFuncionario = "";
        tipoAcesso = "";
    }
    await fetchOperators();
    if (tipoAcesso !== 'master' && tipoAcesso !== ''){
        selectedOperator = parseInt(idFuncionario);
    }
    populateOperatorSelect(selectedOperator);
    setupEventListeners();
}

async function fetchOperators() {
    let urlOperadores = "";
    if (tipoAcesso !== 'master' && tipoAcesso !== ''){
        urlOperadores = `/api/funcionarios/?func_id=${idFuncionario}`
    }else{
        urlOperadores = `/api/funcionarios/`;
    }
    try {
        const response = await fetch(urlOperadores, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        operators = data; // Assuming your API returns an array of operators
        return operators;
    } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
        // Show user-friendly error message
        alert('Falha ao carregar funcionários! Por favor, verifique a sua conexão e tente novamente.');
        return [];
    }
}

function populateOperatorSelect(operadorSelecionado) {
    const select = document.getElementById('operatorSelect');
    if (operators.length == 1) {
        operators.forEach(operator => {
            const option = document.createElement('option');
            option.value = operator.id;
            option.selected = true;
            option.textContent = `${operator.matricula} - ${operator.nome}`;
            select.appendChild(option);
        });

        // Chama o evento de mudança manualmente
        handleOperatorUnique();
    }else{
        operators.forEach(operator => {
            const option = document.createElement('option');
            option.value = operator.id;
            option.textContent = `${operator.matricula} - ${operator.nome}`;
            select.appendChild(option);
        });
    }

    const optionPadrao = select.querySelector('option[value=""]');
    optionPadrao.textContent = 'Selecione um funcionário...';

}

function setupEventListeners() {
    $('#operatorSelect').select2();
    $('#operatorSelect').on('change', handleOperatorChange);
}

function handleOperatorChange(event) {
    selectedOperator = parseInt(event.target.value);
    
    if (selectedOperator) {
        showPPEItems();
    } else {
        hidePPEItems();
    }
}

function handleOperatorUnique() {
    if (selectedOperator) {
        showPPEItems();
    } else {
        hidePPEItems();
    }
}

async function showPPEItems() {
    const operator = operators.find(op => op.id === selectedOperator);
    
    document.getElementById('ppeItemsCard').style.display = 'block';
    document.getElementById('emptyStateCard').style.display = 'none';
    document.getElementById('operatorInfo').textContent = 
        `EPIs atualmente atribuídos à ${operator.nome}`;
    
    // Fetch PPE items from API
    const items = await fetchActiveItems(selectedOperator);
    
    if (items.length > 0) {
        populatePPETable(items);
        showPPEItemsTable();
    }
    // Error and no-items states are handled in fetchOperatorPPEItems
}

function hidePPEItems() {
    document.getElementById('ppeItemsCard').style.display = 'none';
    document.getElementById('emptyStateCard').style.display = 'block';
}

function populatePPETable(items) {
    const tbody = document.getElementById('ppeTableBody');
    
    tbody.innerHTML = '';
    
    items.forEach(item => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td class='fw-medium'>
                ${item.id}
            </td>
            <td class='fw-medium'>
                ${item.equipamento_nome}
            </td>
            <td class="serial-number">${item.equipamento_codigo}</td>
            <td>
                <i class="bi bi-calendar3 me-1 text-muted"></i>
                ${item.data_recebimento}
            </td>
            <td class="text-center">
                ${item.quantidade_disponivel}
            </td>
        `;
        
        tbody.appendChild(row);

    });  
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);