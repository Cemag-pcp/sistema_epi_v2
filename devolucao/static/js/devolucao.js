// Mock data
const operators = [
    { id: "1", name: "John Smith", department: "Construction" },
    { id: "2", name: "Maria Garcia", department: "Manufacturing" },
    { id: "3", name: "David Johnson", department: "Maintenance" },
    { id: "4", name: "Sarah Wilson", department: "Quality Control" },
];

const ppeItems = {
    "1": [
        { id: "ppe-1", name: "Safety Helmet", category: "Head Protection", assignedDate: "2023-12-01", condition: "Worn", serialNumber: "SH-001" },
        { id: "ppe-1b", name: "Safety Helmet", category: "Head Protection", assignedDate: "2024-01-15", condition: "Good", serialNumber: "SH-015" },
        { id: "ppe-2", name: "Safety Glasses", category: "Eye Protection", assignedDate: "2024-01-15", condition: "Good", serialNumber: "SG-045" },
        { id: "ppe-3", name: "Work Gloves", category: "Hand Protection", assignedDate: "2024-01-10", condition: "Damaged", serialNumber: "WG-123" },
        { id: "ppe-3b", name: "Work Gloves", category: "Hand Protection", assignedDate: "2024-02-01", condition: "Good", serialNumber: "WG-456" },
        { id: "ppe-4", name: "Safety Boots", category: "Foot Protection", assignedDate: "2024-01-10", condition: "Good", serialNumber: "SB-789" },
        { id: "ppe-5", name: "High-Vis Vest", category: "Body Protection", assignedDate: "2024-01-15", condition: "Good", serialNumber: "HV-456" },
    ],
    "2": [
        { id: "ppe-6", name: "Safety Helmet", category: "Head Protection", assignedDate: "2024-02-10", condition: "Good", serialNumber: "SH-002" },
        { id: "ppe-7", name: "Ear Plugs", category: "Hearing Protection", assignedDate: "2024-02-10", condition: "Good", serialNumber: "EP-234" },
        { id: "ppe-8", name: "Chemical Gloves", category: "Hand Protection", assignedDate: "2024-02-15", condition: "Good", serialNumber: "CG-567" },
        { id: "ppe-9", name: "Safety Goggles", category: "Eye Protection", assignedDate: "2024-02-10", condition: "Good", serialNumber: "SG-890" },
    ],
    "3": [
        { id: "ppe-10", name: "Safety Helmet", category: "Head Protection", assignedDate: "2024-01-20", condition: "Good", serialNumber: "SH-003" },
        { id: "ppe-11", name: "Work Gloves", category: "Hand Protection", assignedDate: "2024-01-20", condition: "Damaged", serialNumber: "WG-345" },
        { id: "ppe-12", name: "Safety Harness", category: "Fall Protection", assignedDate: "2024-01-25", condition: "Good", serialNumber: "SH-678" },
        { id: "ppe-13", name: "Respirator Mask", category: "Respiratory Protection", assignedDate: "2024-02-05", condition: "Good", serialNumber: "RM-901" },
    ],
    "4": [
        { id: "ppe-14", name: "Safety Glasses", category: "Eye Protection", assignedDate: "2024-02-20", condition: "Good", serialNumber: "SG-234" },
        { id: "ppe-15", name: "Lab Coat", category: "Body Protection", assignedDate: "2024-02-20", condition: "Good", serialNumber: "LC-567" },
        { id: "ppe-16", name: "Nitrile Gloves", category: "Hand Protection", assignedDate: "2024-02-20", condition: "Good", serialNumber: "NG-890" },
    ],
};

// State variables
let selectedOperator = "";
let selectedItems = [];
let itemConditions = {};
let itemReturnDates = {};

// Helper functions
function getTodayDate() {
    return new Date().toISOString().split("T")[0];
}

function getOldestDuplicateItems(items) {
    const itemGroups = {};
    items.forEach(item => {
        if (!itemGroups[item.name]) {
            itemGroups[item.name] = [];
        }
        itemGroups[item.name].push(item);
    });

    const oldestDuplicateIds = new Set();
    Object.values(itemGroups).forEach(group => {
        if (group.length > 1) {
            const oldest = group.reduce((prev, current) =>
                new Date(prev.assignedDate) < new Date(current.assignedDate) ? prev : current
            );
            oldestDuplicateIds.add(oldest.id);
        }
    });

    return oldestDuplicateIds;
}

function getConditionBadge(condition) {
    const variants = {
        Good: "success",
        Worn: "secondary",
        Damaged: "danger"
    };
    return `<span class="badge bg-${variants[condition] || 'secondary'}">${condition}</span>`;
}

function getCurrentCondition(item) {
    return itemConditions[item.id] || item.condition;
}

function getCurrentReturnDate(itemId) {
    return itemReturnDates[itemId] || getTodayDate();
}

// Initialize page
function initializePage() {
    populateOperatorSelect();
    setupEventListeners();
}

function populateOperatorSelect() {
    const select = document.getElementById('operatorSelect');
    operators.forEach(operator => {
        const option = document.createElement('option');
        option.value = operator.id;
        option.innerHTML = `
            <div>
                <div>${operator.name}</div>
                <small>${operator.department}</small>
            </div>
        `;
        option.textContent = `${operator.name} - ${operator.department}`;
        select.appendChild(option);
    });
}

function setupEventListeners() {
    document.getElementById('operatorSelect').addEventListener('change', handleOperatorChange);
    document.getElementById('selectAll').addEventListener('change', handleSelectAll);
    document.getElementById('processReturnBtn').addEventListener('click', handleSubmit);
    document.getElementById('confirmReturnBtn').addEventListener('click', handleConfirmReturn);
}

function handleOperatorChange(event) {
    selectedOperator = event.target.value;
    selectedItems = [];
    itemConditions = {};
    itemReturnDates = {};
    
    if (selectedOperator) {
        showPPEItems();
    } else {
        hidePPEItems();
    }
}

function showPPEItems() {
    const operator = operators.find(op => op.id === selectedOperator);
    const items = ppeItems[selectedOperator] || [];
    
    document.getElementById('ppeItemsCard').style.display = 'block';
    document.getElementById('emptyStateCard').style.display = 'none';
    document.getElementById('operatorInfo').textContent = 
        `PPE items currently assigned to ${operator.name} (${operator.department})`;
    
    populatePPETable(items);
    updateSelectionUI();
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
                ${item.name}
                ${isOldest ? '<span class="badge bg-danger ms-2" style="font-size: 0.7rem;">Oldest</span>' : ''}
            </td>
            <td>${item.category}</td>
            <td class="serial-number">${item.serialNumber}</td>
            <td>
                <i class="bi bi-calendar3 me-1 text-muted"></i>
                ${item.assignedDate}
            </td>
            <td class="condition-cell" data-item-id="${item.id}">
                <span class="text-muted">Select to view</span>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Add event listeners to checkboxes
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleItemToggle);
    });
    
    updateSelectAllLabel(items.length);
}

function handleItemToggle(event) {
    const itemId = event.target.value;
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
    const items = ppeItems[selectedOperator] || [];
    const item = items.find(i => i.id === itemId);
    
    if (!item) return;
    
    if (isSelected) {
        const currentCondition = getCurrentCondition(item);
        const isModified = itemConditions[itemId] && itemConditions[itemId] !== item.condition;
        
        cell.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <select class="form-select form-select-sm condition-select" data-item-id="${itemId}" style="width: 120px;">
                    <option value="Good" ${currentCondition === 'Good' ? 'selected' : ''}>Good</option>
                    <option value="Worn" ${currentCondition === 'Worn' ? 'selected' : ''}>Worn</option>
                    <option value="Damaged" ${currentCondition === 'Damaged' ? 'selected' : ''}>Damaged</option>
                </select>
                ${isModified ? '<span class="condition-modified">Modified</span>' : ''}
            </div>
        `;
        
        // Add event listener to the select
        cell.querySelector('.condition-select').addEventListener('change', handleConditionChange);
    } else {
        cell.innerHTML = '<span class="text-muted">Select to view</span>';
    }
}

function handleConditionChange(event) {
    const itemId = event.target.dataset.itemId;
    const newCondition = event.target.value;
    itemConditions[itemId] = newCondition;
    
    // Update the modified indicator
    updateConditionCell(itemId, true);
}

function handleSelectAll() {
    const items = ppeItems[selectedOperator] || [];
    const allItemIds = items.map(item => item.id);
    const selectAllCheckbox = document.getElementById('selectAll');
    
    if (selectAllCheckbox.checked) {
        selectedItems = [...allItemIds];
    } else {
        selectedItems = [];
    }
    
    // Update individual checkboxes
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        updateConditionCell(checkbox.value, checkbox.checked);
    });
    
    updateSelectionUI();
}

function updateSelectionUI() {
    const items = ppeItems[selectedOperator] || [];
    const totalItems = items.length;
    const selectedCount = selectedItems.length;
    
    // Update select all checkbox
    const selectAllCheckbox = document.getElementById('selectAll');
    selectAllCheckbox.checked = selectedCount === totalItems && totalItems > 0;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalItems;
    
    // Update labels
    updateSelectAllLabel(totalItems);
    document.getElementById('selectionCount').textContent = `${selectedCount} of ${totalItems} selected`;
    
    // Update process button
    const processBtn = document.getElementById('processReturnBtn');
    processBtn.disabled = selectedCount === 0;
    processBtn.textContent = `Process Return (${selectedCount} items)`;
}

function updateSelectAllLabel(totalItems) {
    document.getElementById('selectAllLabel').textContent = `Select All (${totalItems} items)`;
}

function handleSubmit() {
    if (selectedItems.length === 0) {
        alert("Please select at least one item to return.");
        return;
    }
    
    // Initialize return dates for selected items
    selectedItems.forEach(itemId => {
        if (!itemReturnDates[itemId]) {
            itemReturnDates[itemId] = getTodayDate();
        }
    });
    
    showConfirmModal();
}

function showConfirmModal() {
    const operator = operators.find(op => op.id === selectedOperator);
    const items = ppeItems[selectedOperator] || [];
    const oldestDuplicateIds = getOldestDuplicateItems(items);
    
    // Update modal header info
    document.getElementById('modalOperatorName').textContent = operator.name;
    document.getElementById('modalOperatorDept').textContent = operator.department;
    document.getElementById('modalItemCount').textContent = selectedItems.length;
    document.getElementById('confirmItemCount').textContent = selectedItems.length;
    
    // Populate items list
    const itemsList = document.getElementById('modalItemsList');
    itemsList.innerHTML = '';
    
    selectedItems.forEach(itemId => {
        const item = items.find(i => i.id === itemId);
        if (!item) return;
        
        const currentCondition = getCurrentCondition(item);
        const isConditionModified = itemConditions[itemId] && itemConditions[itemId] !== item.condition;
        const isOldest = oldestDuplicateIds.has(item.id);
        
        const itemDiv = document.createElement('div');
        itemDiv.className = `return-date-section ${isOldest ? 'border-danger bg-danger-subtle' : ''}`;
        
        itemDiv.innerHTML = `
            <div class="row">
                <div class="col-md-8">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <span class="fw-medium ${isOldest ? 'text-danger' : ''}">${item.name}</span>
                        ${isOldest ? '<span class="badge bg-danger">Oldest</span>' : ''}
                    </div>
                    <div class="row g-2 small text-muted">
                        <div class="col-6"><strong>Category:</strong> ${item.category}</div>
                        <div class="col-6"><strong>Serial:</strong> ${item.serialNumber}</div>
                        <div class="col-6"><strong>Assigned:</strong> ${item.assignedDate}</div>
                        <div class="col-6">
                            <strong>Condition:</strong> ${getConditionBadge(currentCondition)}
                            ${isConditionModified ? '<span class="condition-modified ms-1">Modified</span>' : ''}
                        </div>
                    </div>
                    ${isConditionModified ? `<p class="small text-muted mt-1">Original: ${getConditionBadge(item.condition)}</p>` : ''}
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
    itemReturnDates[itemId] = date;
}

function handleConfirmReturn() {
    const operator = operators.find(op => op.id === selectedOperator);
    const items = ppeItems[selectedOperator] || [];
    
    // Get the final details for selected items
    const itemsWithDetails = selectedItems.map(itemId => {
        const item = items.find(i => i.id === itemId);
        const finalCondition = itemConditions[itemId] || item.condition;
        const returnDate = itemReturnDates[itemId] || getTodayDate();
        
        return {
            ...item,
            condition: finalCondition,
            returnDate: returnDate
        };
    });
    
    console.log("Items being returned:", itemsWithDetails);
    alert(`Successfully processed return of ${selectedItems.length} item(s) for ${operator.name}`);
    
    // Reset form
    selectedItems = [];
    itemConditions = {};
    itemReturnDates = {};
    
    // Hide modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
    modal.hide();
    
    // Refresh the table
    if (selectedOperator) {
        showPPEItems();
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);