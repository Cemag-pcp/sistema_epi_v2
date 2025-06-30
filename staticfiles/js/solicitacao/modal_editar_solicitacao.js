// Função para adicionar novo formulário clonado para solicitação
export function addSolicitacaoClone(equipamento= '', matricula='', nome='') {
    const cloneContainer = document.getElementById('clone-container-solicitacao');
    const originals = cloneContainer.querySelectorAll('.clone-form-solicitacao');
    const lastOriginal = originals[originals.length - 1];
    const clone = lastOriginal.cloneNode(true);

    // Armazena os dados do funcionário no clone
    clone.dataset.equipamento = equipamento;
    clone.dataset.matricula = matricula;
    clone.dataset.nome = nome;
    
    const requestText = clone.querySelector('.request');
    if (equipamento !== '' && matricula !== '' && nome !== '') {
        // Atualiza o texto do item
        if (requestText) {
            const cloneNumber = originals.length + 1;
            requestText.textContent = `${cloneNumber}ª - ${equipamento} | ${matricula} - ${nome}`;
        }
    } else {
        if (requestText) {
            const cloneNumber = originals.length + 1;
            requestText.textContent = `${cloneNumber}ª Item da Solicitação`;
        }
    }

    // Limpa os valores dos inputs
    const inputs = clone.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        if (input.tagName === 'SELECT') {
            input.selectedIndex = 0;
        } else if (input.type !== 'submit') {
            input.value = '';
            if (input.name === 'quantity') input.value = 1;
        }
    });

    // Adiciona o clone ao container
    cloneContainer.appendChild(clone);

    // Atualiza TODOS os data-index após adicionar o novo clone
    updateSolicitacaoRemoveButtonsIndexes();

    toggleSolicitacaoCollapseFunction();
}

// Função para atualizar todos os data-index dos botões de remoção
function updateSolicitacaoRemoveButtonsIndexes() {
    const cloneContainer = document.getElementById('clone-container-solicitacao');
    const clones = cloneContainer.querySelectorAll('.clone-form-solicitacao');
    
    clones.forEach((clone, index) => {
        const removeBtn = clone.querySelector('.remove-specific');
        if (removeBtn) {
            removeBtn.setAttribute('data-index', index);
        }
        
        // Obtém os dados do funcionário do próprio clone
        const matricula = clone.dataset.matricula || '';
        const nome = clone.dataset.nome || '';
        const equipamento = clone.dataset.equipamento || '';

        // Atualiza também o texto da solicitação para garantir consistência
        const requestText = clone.querySelector('.request');
        if (equipamento !== '' && matricula !== '' && nome !== '') {
            if (requestText) {
                requestText.textContent = `${index + 1}ª - ${equipamento} | ${matricula} - ${nome}`;
            }
        } else {
            if (requestText) {
                requestText.textContent = `${index + 1}ª Item da Solicitação`;
            }
        }

        // Atualiza IDs e targets para os elementos de collapse
        const formFields = clone.querySelector('.collapse');
        if (formFields) {
            formFields.setAttribute('id', `formFieldsSolicitacao-${index}`);
        }

        const toggleCollapse = clone.querySelector('.toggle-collapse');
        if (toggleCollapse) {
            toggleCollapse.setAttribute('data-bs-target', `#formFieldsSolicitacao-${index}`);
        }
    });
}

function toggleSolicitacaoCollapseFunction() {
    document.querySelectorAll('.toggle-collapse').forEach(button => {
        button.addEventListener('click', function() {
            const icon = this.querySelector('i');
            if (this.getAttribute('aria-expanded') === 'true') {
                icon.classList.remove('bi-chevron-up');
                icon.classList.add('bi-chevron-down');
            } else {
                icon.classList.remove('bi-chevron-down');
                icon.classList.add('bi-chevron-up');
            }
        });
    });
}

// Função para remover um clone específico da solicitação
export function removeSpecificSolicitacaoClone(indexToRemove) {
    const cloneContainer = document.getElementById('clone-container-solicitacao');
    const clones = cloneContainer.querySelectorAll('.clone-form-solicitacao');
    const Toast = Swal.mixin({
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.onmouseenter = Swal.stopTimer;
            toast.onmouseleave = Swal.resumeTimer;
        }
    });
    
    // Verifica se há mais de um clone e se o índice é válido
    if (clones.length > 1 && indexToRemove >= 0 && indexToRemove < clones.length) {
        // Remove o clone específico
        cloneContainer.removeChild(clones[indexToRemove]);
        
        // Atualiza todos os índices após remoção
        updateSolicitacaoRemoveButtonsIndexes();
    } else if (clones.length <= 1) {
        // Não permite remover o último clone
        Toast.fire({
            icon: 'warning',
            title: 'Você não pode remover o último item!'
        });
    }
}

// Função para preencher o modal de edição de solicitação
export async function preencherModalEdicaoSolicitacao(data) {
    const modalTitle = document.querySelector('#modal-editar-solicitacao .modal-title');
    const cloneContainer = document.getElementById('clone-container-solicitacao');
    
    // Limpar clones existentes (exceto o primeiro)
    const clones = cloneContainer.querySelectorAll('.clone-form-solicitacao');
    clones.forEach((clone, index) => {
        if (index > 0) {
            cloneContainer.removeChild(clone);
        }
    });
    
    // Atualizar título do modal
    modalTitle.textContent = `Editar Solicitação #${data.solicitacao.id}`;
    
    // Preencher o primeiro formulário
    const firstForm = cloneContainer.querySelector('.clone-form-solicitacao');
    
    if (firstForm && data.solicitacao.dados_solicitacao.length > 0) {
        const primeiroItem = data.solicitacao.dados_solicitacao[0];

        firstForm.dataset.equipamento = primeiroItem.equipamento_nome;
        firstForm.dataset.matricula = data.solicitacao.funcionario_matricula || '';
        firstForm.dataset.nome = data.solicitacao.funcionario_nome;
        
        // Atualizar o texto do request
        const requestText = firstForm.querySelector('.request');
        if (requestText) {
            requestText.textContent = `1ª - ${primeiroItem.equipamento_nome} | ${primeiroItem.funcionario_matricula || ''} - ${primeiroItem.funcionario_nome}`;
        }

        // Preencher selects básicos
        const itemSelect = firstForm.querySelector('select[name="item"]');
        const funcionarioSelect = firstForm.querySelector('select[name="operator"]');
        const motivoSelect = firstForm.querySelector('select[name="reason"]');
        
        if (itemSelect) {
            itemSelect.innerHTML = '<option value="">Selecione um equipamento</option>';
            data.equipamentos.forEach(equip => {
                const option = document.createElement('option');
                option.value = equip.id;
                option.textContent = equip.nome;
                if (equip.id === primeiroItem.equipamento_id) option.selected = true;
                itemSelect.appendChild(option);
            });
        }
        
        if (funcionarioSelect) {
            funcionarioSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
            funcionarioSelect.disabled = true;
            data.funcionarios_disponiveis.forEach(func => {
                const option = document.createElement('option');
                option.value = func.id;
                option.textContent = `${func.matricula} - ${func.nome}`;
                if (func.id === data.solicitacao.funcionario_id) option.selected = true;
                funcionarioSelect.appendChild(option);
            });
        }

        if (motivoSelect) {
            motivoSelect.innerHTML = '<option value="">Selecione um motivo</option>';
            console.log(data.motivos)
            data.motivos.forEach(motivos => {
                const option = document.createElement('option');
                option.value = motivos[0];
                option.textContent = motivos[1];
                if (motivos[0] === primeiroItem.motivo) option.selected = true;
                motivoSelect.appendChild(option);
            });
        }
        
        // Preencher outros campos do primeiro item
        const qtyInput = firstForm.querySelector('input[name="quantity"]');
        if (qtyInput) qtyInput.value = primeiroItem.quantidade;
        
        const obsInput = firstForm.querySelector('textarea[name="observation"]');
        if (obsInput) obsInput.value = primeiroItem.observacoes || '';
        
        // Adicionar clones para os demais itens
        data.solicitacao.dados_solicitacao.forEach((item, index) => {
            if (index > 0) {
                addSolicitacaoClone(
                    item.equipamento_nome,
                    data.solicitacao.funcionario_matricula || '',
                    data.solicitacao.funcionario_nome
                );
                
                // Preencher os dados do clone recém-criado
                const currentForm = cloneContainer.querySelector(`.clone-form-solicitacao:nth-child(${index + 1})`);
                
                if (currentForm) {
                    // Preencher selects
                    const currentItemSelect = currentForm.querySelector('select[name="item"]');
                    if (currentItemSelect) {
                        currentItemSelect.value = item.equipamento_id;
                    }
                    
                    const currentFuncSelect = currentForm.querySelector('select[name="operator"]');
                    currentFuncSelect.disabled = true;
                    if (currentFuncSelect) {
                        currentFuncSelect.value = data.solicitacao.funcionario_id;
                    }
                    
                    // Preencher outros campos
                    const currentQtyInput = currentForm.querySelector('input[name="quantity"]');
                    if (currentQtyInput) currentQtyInput.value = item.quantidade;
                    
                    const currentObsInput = currentForm.querySelector('textarea[name="observation"]');
                    if (currentObsInput) currentObsInput.value = item.observacoes || '';
                    
                    const currentMotivoSelect = currentForm.querySelector('select[name="reason"]');
                    if (currentMotivoSelect) currentMotivoSelect.value = item.motivo || '';
                }
            }
        });
        
        // Atualizar índices e configurações de collapse
        updateSolicitacaoRemoveButtonsIndexes();
        toggleSolicitacaoCollapseFunction();
    }
}