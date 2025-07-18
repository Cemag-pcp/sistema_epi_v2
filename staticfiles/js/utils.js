export function getOldestDuplicateItems(items) {
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

export function updateSelectAllLabel(totalItems,) {
    document.getElementById('selectAllLabel').textContent = `Selecionar todos (${totalItems} itens)`;
}

export function updateQuantidadeDevolvidaCell(itemId, isSelected, listaItens) {
    const cell = document.querySelector(`[data-item-id="${itemId}"].quantidade-devolvida-cell`);
    const item = listaItens.find(i => i.id === itemId);

    if (!item) return;

    if (isSelected) {
        cell.innerHTML = `<input type="number" data-item-id="${item.id}" 
                            class="form-control form-control-sm" value="${item.quantidade_disponivel}" 
                            min="1" max="${item.quantidade_disponivel}" 
                            style="width: 80px;">
                          </input>`

    } else {
        cell.innerHTML = '<span class="text-muted">Selecione para alterar</span>';
    }
}

export function updateConditionCell(itemId, isSelected, listaItens) {
    const cell = document.querySelector(`[data-item-id="${itemId}"].condition-cell`);
    const item = listaItens.find(i => i.id === itemId);
    
    if (!item) return;
    
    if (isSelected) {
        // const currentCondition = getCurrentCondition(item);

        cell.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <select class="form-select form-select-sm condition-select" data-item-id="${itemId}" style="width: 120px;">
                    <option value="bom" selected >Bom</option>
                    <option value="ruim">Ruim</option>
                    <option value="danificado">Danificado</option>
                </select>
            </div>
        `;
        
        // Add event listener to the select
        // cell.querySelector('.condition-select').addEventListener('change', handleConditionChange);
    } else {
        cell.innerHTML = '<span class="text-muted">Selecione para ver</span>';
    }
}

export function updateSelectionUI(listaItens, selectedItems) {
    const totalItems = listaItens.length;
    const selectedCount = selectedItems.length;
    
    // Update select all checkbox
    const selectAllCheckbox = document.getElementById('selectAll');
    selectAllCheckbox.checked = selectedCount === totalItems && totalItems > 0;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalItems;
    
    // Update labels
    updateSelectAllLabel(totalItems);
    document.getElementById('selectionCount').textContent = `${selectedCount} de ${totalItems} selecionados`;
    
}

export function handleSelectAll(listaItens, selectedItems) {
    // const items = ppeItems[selectedOperator] || [];
    // console.log('Handling select all');
    const allItemIds = listaItens.map(item => item.id);
    const selectAllCheckbox = document.getElementById('selectAll');
    
    if (selectAllCheckbox.checked) {
        selectedItems = [...allItemIds];
    } else {
        selectedItems = [];
    }

    console.log('Selected items:', selectedItems);
    
    // Update individual checkboxes
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        updateConditionCell(parseInt(checkbox.value), checkbox.checked, listaItens);
        updateQuantidadeDevolvidaCell(parseInt(checkbox.value), checkbox.checked, listaItens);
    });
    
    updateSelectionUI(listaItens, selectedItems);

    return selectedItems;
}

export function showErrorNotification(message) {
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