import { getCookie } from "/static/js/scripts.js";

let operators = [];
let currentOperatorPPEItems = [];
let itemConditions = {};

// State variables
let selectedOperator = "";
let selectedItems = [];

// UI State Management Functions
function showPPELoadingState() {
    document.getElementById('ppeLoadingState').style.display = 'block';
    document.getElementById('ppeLoadingSpinner').style.display = 'inline-block';
    document.getElementById('ppeControls').style.display = 'none';
    document.getElementById('ppeTableContainer').style.display = 'none';
    document.getElementById('processButtonContainer').style.display = 'none';
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
    document.getElementById('ppeControls').style.display = 'none';
    document.getElementById('ppeTableContainer').style.display = 'none';
    document.getElementById('processButtonContainer').style.display = 'none';
    document.getElementById('noItemsState').style.display = 'none';
}

function showNoItemsState() {
    document.getElementById('noItemsState').style.display = 'block';
    document.getElementById('processButtonContainer').style.display = 'none';
    document.getElementById('ppeTableContainer').style.display = 'none';
    document.getElementById('processButtonContainer').style.display = 'none';
    document.getElementById('ppeErrorState').style.display = 'none';
}

function showPPEItemsTable() {
    document.getElementById('ppeControls').style.display = 'flex';
    document.getElementById('ppeTableContainer').style.display = 'block';
    document.getElementById('processButtonContainer').style.display = 'flex';
    document.getElementById('ppeErrorState').style.display = 'none';
    document.getElementById('noItemsState').style.display = 'none';
}

function showErrorNotification(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed';
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function getOldestDuplicateItems(items) {
    const itemGroups = {};
    items.forEach(item => {
        if (!itemGroups[item.equipamento_nome]) {
            itemGroups[item.equipamento_nome] = [];
        }
        itemGroups[item.equipamento_nome].push(item);
    });

    const oldestDuplicateIds = new Set();
    Object.values(itemGroups).forEach(group => {
        if (group.length > 1) {
            const oldest = group.reduce((prev, current) =>
                new Date(prev.data_recebimento) < new Date(current.data_recebimento) ? prev : current
            );
            oldestDuplicateIds.add(oldest.id);
        }
    });

    return oldestDuplicateIds;
}

function getConditionBadge(condition) {
    const variants = {
        bom: "success",
        ruim: "secondary",
        danificado: "danger"
    };
    return `<span class="badge bg-${variants[condition] || 'secondary'}">${condition}</span>`;
}

function getCurrentCondition(item) {
    return itemConditions[item.id] || item.condition;
}

// Initialize page
async function initializePage() {
    await fetchOperators();
    populateOperatorSelect();
    setupEventListeners();
}

async function fetchOperators() {
    try {
        const response = await fetch(`/api/funcionarios/`, {
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

function populateOperatorSelect() {
    const select = document.getElementById('operatorSelect');
    operators.forEach(operator => {
        const option = document.createElement('option');
        option.value = operator.id;
        option.textContent = `${operator.matricula} - ${operator.nome}`;
        select.appendChild(option);
    });
}

function setupEventListeners() {
    document.getElementById('operatorSelect').addEventListener('change', handleOperatorChange);
    document.getElementById('selectAll').addEventListener('change', handleSelectAll);
    document.getElementById('processObservationBtn').addEventListener('click', handleSubmit);
    document.getElementById('confirmObservationBtn').addEventListener('click', handleConfirmObservation);
    document.getElementById('retryPpeBtn').addEventListener('click', handleRetryPPE);
}

function handleOperatorChange(event) {
    selectedOperator = parseInt(event.target.value);
    selectedItems = [];
    itemConditions = {};
    
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
    const items = await fetchOperatorPPEItems(selectedOperator);
    
    if (items.length > 0) {
        populatePPETable(items);
        showPPEItemsTable();
        updateSelectionUI();
    }
    // Error and no-items states are handled in fetchOperatorPPEItems
}

function hidePPEItems() {
    document.getElementById('ppeItemsCard').style.display = 'none';
    document.getElementById('emptyStateCard').style.display = 'block';
}

function populatePPETable(items) {
    const tbody = document.getElementById('ppeTableBody');
    const oldestDuplicateIds = getOldestDuplicateItems(items);
    
    tbody.innerHTML = '';
    
    items.forEach(item => {
        const isOldest = oldestDuplicateIds.has(item.id);
        const row = document.createElement('tr');
        row.className = isOldest ? 'oldest-item' : '';
        
        row.innerHTML = `
            <td>
                <input class="form-check-input item-checkbox" type="checkbox" value="${item.id}" data-item-id="${item.id}">
            </td>
            <td class="${isOldest ? 'text-danger fw-medium' : 'fw-medium'}">
                ${item.equipamento_nome}
                ${isOldest ? '<span class="badge bg-danger ms-2" style="font-size: 0.7rem;">Mais antigo</span>' : ''}
            </td>
            <td class="serial-number">${item.equipamento_codigo}</td>
            <td>
                <i class="bi bi-calendar3 me-1 text-muted"></i>
                ${item.data_recebimento}
            </td>
            <td class="condition-cell" data-item-id="${item.id}">
                <span class="text-muted">Selecione para ver</span>
            </td>
        `;
        
        tbody.appendChild(row);

        itemConditions[item.id] = 'bom';
    });  
    
    // Add event listeners to checkboxes
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleItemToggle);
    });
    
    updateSelectAllLabel(items.length);
}

async function handleConfirmObservation() {
    const operator = operators.find(op => op.id === selectedOperator);
    
    const itemsWithDetails = selectedItems.map(itemId => {
        const item = currentOperatorPPEItems.find(i => i.id === itemId);
        const finalCondition = itemConditions[itemId] || item.condition;
        const observation = document.getElementById(`obsDevolucao-${itemId}`).value || "";
        
        return {
            ...item,
            condicao: finalCondition,
            observacao: observation
        };
    });

    const confirmBtn = document.getElementById('confirmObservationBtn');
    const originalText = confirmBtn.innerHTML;
    
    
    try {
        // Show loading state on the confirm button
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processando...';

        // ✅ ADD: API requisition to finish devolution
        // Make API call to finish devolution
        const response = await fetch('/devolucao/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({
                funcionarioId: selectedOperator,
                items: itemsWithDetails,
            })
        });

        if (!response.ok) {
            const errorResult = await response.json();  // 👈 pega a resposta mesmo com erro
            const errorMessage = errorResult.message || `Erro HTTP: ${response.status}`;
            throw new Error(errorMessage);  // 👈 repassa para o catch
        }

        const result = await response.json();
        
        // Show success message
        showSuccessNotification(`Devoluções de ${selectedItems.length} item(s) para ${operator.nome} concluídas com sucesso!`);
        
        // Reset form
        selectedItems = [];
        itemConditions = {};
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
        modal.hide();
        
        // Refresh the table
        if (selectedOperator) {
            await showPPEItems(); // Refresh to show updated data
        }
        
    } catch (error) {
        console.error('Erro ao finalizar devolução:', error);
        
        // Show error message
        showErrorNotification(error.message || 'Erro desconhecido ao processar devolução.');
        
        // Re-enable button
        const confirmBtn = document.getElementById('confirmObservationBtn');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
    }
}

// ✅ ADD: Success notification function
function showSuccessNotification(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    alertDiv.innerHTML = `
        <i class="bi bi-check-circle me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function handleItemToggle(event) {
    const itemId = parseInt(event.target.value);
    const isChecked = event.target.checked;
    
    if (isChecked) {
        if (!selectedItems.includes(itemId)) {
            selectedItems.push(itemId);
        }
    } else {
        selectedItems = selectedItems.filter(id => id !== itemId);
    }
    
    updateConditionCell(itemId, isChecked);
    updateSelectionUI();
}

function updateConditionCell(itemId, isSelected) {
    const cell = document.querySelector(`[data-item-id="${itemId}"].condition-cell`);
    const item = currentOperatorPPEItems.find(i => i.id === itemId);
    
    if (!item) return;
    
    if (isSelected) {
        const currentCondition = getCurrentCondition(item);

        cell.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <select class="form-select form-select-sm condition-select" data-item-id="${itemId}" style="width: 120px;">
                    <option value="bom" ${currentCondition === 'bom' ? 'selected' : ''}>Bom</option>
                    <option value="ruim" ${currentCondition === 'ruim' ? 'selected' : ''}>Ruim</option>
                    <option value="danificado" ${currentCondition === 'danificado' ? 'selected' : ''}>Danificado</option>
                </select>
            </div>
        `;
        
        // Add event listener to the select
        cell.querySelector('.condition-select').addEventListener('change', handleConditionChange);
    } else {
        cell.innerHTML = '<span class="text-muted">Selecione para ver</span>';
    }
}

function handleConditionChange(event) {
    const itemId = parseInt(event.target.dataset.itemId);
    const newCondition = event.target.value;
    itemConditions[itemId] = newCondition;
    // Update the modified indicator
    updateConditionCell(itemId, true);
}

function handleSelectAll() {
    // const items = ppeItems[selectedOperator] || [];
    const allItemIds = currentOperatorPPEItems.map(item => item.id);
    const selectAllCheckbox = document.getElementById('selectAll');
    
    if (selectAllCheckbox.checked) {
        selectedItems = [...allItemIds];
    } else {
        selectedItems = [];
    }
    
    // Update individual checkboxes
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        updateConditionCell(parseInt(checkbox.value), checkbox.checked);
    });
    
    updateSelectionUI();
}

function updateSelectionUI() {
    const totalItems = currentOperatorPPEItems.length;
    const selectedCount = selectedItems.length;
    
    // Update select all checkbox
    const selectAllCheckbox = document.getElementById('selectAll');
    selectAllCheckbox.checked = selectedCount === totalItems && totalItems > 0;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalItems;
    
    // Update labels
    updateSelectAllLabel(totalItems);
    document.getElementById('selectionCount').textContent = `${selectedCount} de ${totalItems} selecionados`;
    
    // Update process button
    const processBtn = document.getElementById('processObservationBtn');
    processBtn.disabled = selectedCount === 0;
    processBtn.textContent = `Processar Devolução (${selectedCount} itens)`;
}

function updateSelectAllLabel(totalItems) {
    document.getElementById('selectAllLabel').textContent = `Selecionar todos (${totalItems} itens)`;
}

function handleSubmit() {
    if (selectedItems.length === 0) {
        alert("Por favor, selecione pelo menos um item para devolver.");
        return;
    }
    
    showConfirmModal();
}

function showConfirmModal() {
    const operator = operators.find(op => op.id === selectedOperator);
    const items = currentOperatorPPEItems;
    const oldestDuplicateIds = getOldestDuplicateItems(items);
    
    // Update modal header info
    document.getElementById('modalOperatorName').textContent = operator.nome;
    document.getElementById('modalOperatorMatricula').textContent = operator.matricula;
    document.getElementById('modalItemCount').textContent = selectedItems.length;
    document.getElementById('confirmItemCount').textContent = selectedItems.length;
    
    // Populate items list
    const itemsList = document.getElementById('modalItemsList');
    itemsList.innerHTML = '';
    
    selectedItems.forEach(itemId => {
        const item = items.find(i => i.id === itemId);
        if (!item) return;
        
        const currentCondition = getCurrentCondition(item);
        const isOldest = oldestDuplicateIds.has(item.id);       
        const itemDiv = document.createElement('div');
        itemDiv.className = `return-date-section ${isOldest ? 'border-danger bg-danger-subtle' : ''}`;
        
        itemDiv.innerHTML = `
            <div class="row">
                <div class="col-md-8">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <span class="fw-medium ${isOldest ? 'text-danger' : ''}">${item.equipamento_nome}</span>
                        ${isOldest ? '<span class="badge bg-danger">Mais antigo</span>' : ''}
                    </div>
                    <div class="row g-2 small text-muted">
                        <div class="col-6"><strong>Código:</strong> ${item.equipamento_codigo}</div>
                        <div class="col-6"><strong>Atribuído em:</strong> ${item.data_recebimento}</div>
                        <div class="col-6">
                            <strong>Condição:</strong> ${getConditionBadge(currentCondition)}
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <label for="obsDevolucao-${item.id}" class="form-label small fw-medium">Observação</label>
                    <textarea class="form-control return-obs-input" id="obsDevolucao-${item.id}"></textarea>
                </div>
            </div>
        `;
        
        itemsList.appendChild(itemDiv);
    });
    
    // Add event listeners to return date inputs
    document.querySelectorAll('.return-date-input').forEach(input => {
        input.addEventListener('change', handleReturnDateChange);
    });
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    modal.show();
}

function handleReturnDateChange(event) {
    const itemId = event.target.dataset.itemId;
    const date = event.target.value;
}

async function fetchOperatorPPEItems(operatorId) {
    try {
        showPPELoadingState();

        const response = await fetch(`/api_itens_ativos/${operatorId}/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                // Operator has no PPE items
                hidePPELoadingState();
                showNoItemsState();
                return [];
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Validate response structure
        if (!Array.isArray(data)) {
            throw new Error('Invalid response format: expected array of PPE items');
        }
        
        currentOperatorPPEItems = data;
        hidePPELoadingState();
        return data;

    } catch (error) {
        console.error('Error fetching PPE items:', error);
        hidePPELoadingState();
        showPPEErrorState(error);
        return [];
    }
}

function handleRetryPPE() {
    if (selectedOperator) {
        fetchOperatorPPEItems(selectedOperator).then(items => {
            if (items.length > 0) {
                populatePPETable(items);
                showPPEItemsTable();
                updateSelectionUI();
            }
        });
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);