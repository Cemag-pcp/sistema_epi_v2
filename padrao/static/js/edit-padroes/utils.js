// Função para adicionar novo formulário clonado
export function addCloneForm() {
    const cloneContainer = document.getElementById('clone-container-3');
    const originals = cloneContainer.querySelectorAll('.clone-form-3');
    const lastOriginal = originals[originals.length - 1];
    const clone = lastOriginal.cloneNode(true);

    // Atualiza o número da solicitação
    const requestText = clone.querySelector('.request');
    if (requestText) {
        const cloneNumber = originals.length + 1;
        requestText.textContent = `${cloneNumber}ª Solicitação do Padrão`;
    }

    // Limpa os valores dos inputs
    const inputs = clone.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        if (input.tagName === 'SELECT') {
            input.selectedIndex = 0;
        } else if (input.type !== 'submit') {
            input.value = '';
        }
    });

    // Adiciona o clone ao container
    cloneContainer.appendChild(clone);

    // Atualiza TODOS os data-index após adicionar o novo clone
    updateRemoveButtonsIndexes();

    toggleCollapseFunction()
}

// Função para atualizar todos os data-index dos botões de remoção
function updateRemoveButtonsIndexes() {
    const cloneContainer = document.getElementById('clone-container-3');
    const clones = cloneContainer.querySelectorAll('.clone-form-3');
    clones.forEach((clone, index) => {
        const removeBtn = clone.querySelector('.remove-specific');
        if (removeBtn) {
            removeBtn.setAttribute('data-index', index);
        }
        
        // Atualiza também o texto da solicitação para garantir consistência
        const requestText = clone.querySelector('.request');
        if (requestText) {
            requestText.textContent = `${index + 1}ª Solicitação do Padrão`;
        }

        const formFields = clone.querySelector('.collapse');
        if (formFields) {
            formFields.setAttribute('id', `formFields-${index}`);
        }

        const toggleCollapse = clone.querySelector('.toggle-collapse');
        if (toggleCollapse) {
            toggleCollapse.setAttribute('data-bs-target', `#formFields-${index}`);
        }
    });
}

function toggleCollapseFunction(){
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

// Função para remover o último formulário clonado (mantida como está)
export function removeSpecificClone(indexToRemove) {
    const cloneContainer = document.getElementById('clone-container-3');
    const clones = cloneContainer.querySelectorAll('.clone-form-3');
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
        updateRemoveButtonsIndexes();
    } else if (clones.length <= 1) {
        // Não permite remover o último clone
        Toast.fire({
            icon: 'warning',
            title: 'Você não pode remover a última solicitação!'
        });
    }
}

export async function preencherModalEdicao(data) {
    const modalTitle = document.querySelector('#modal-editar-padrao .modal-title');
    const cloneContainer = document.getElementById('clone-container-3');
    
    // Limpar clones existentes (exceto o primeiro)
    const clones = cloneContainer.querySelectorAll('.clone-form-3');
    clones.forEach((clone, index) => {
        if (index > 0) {
            cloneContainer.removeChild(clone);
        }
    });
    
    // Atualizar título do modal
    modalTitle.textContent = `Editar ${data.padrao.nome}`;
    
    // Preencher o primeiro formulário
    const firstForm = cloneContainer.querySelector('.clone-form-3');
    
    if (firstForm) {
        // Preencher selects básicos
        const itemSelect = firstForm.querySelector('select[name="item"]');
        const funcionarioSelect = firstForm.querySelector('select[name="operator"]');
        
        if (itemSelect) {
            funcionarioSelect.innerHTML = '<option value="">Selecione um equipamento</option>';
            data.equipamentos.forEach(equip => {
                const option = document.createElement('option');
                option.value = equip.id;
                option.textContent = equip.nome;
                itemSelect.appendChild(option);
            });
        }
        
        if (funcionarioSelect) {
            funcionarioSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
            data.funcionarios_disponiveis.forEach(func => {
                const option = document.createElement('option');
                option.value = func.id;
                option.textContent = `${func.matricula} - ${func.nome}`;
                funcionarioSelect.appendChild(option);
            });
        }
        
        // Variável para controlar o índice dos formulários
        let formIndex = 0;
        
        // Para cada funcionário
        data.padrao.funcionarios.forEach((func, funcIndex) => {
            // Para cada equipamento do funcionário
            func.equipamentos.forEach((equip, equipIndex) => {
                // Se não for o primeiro formulário (já existe), adicionar clone
                if (formIndex > 0) {
                    addCloneForm();
                }
                
                // Pegar o formulário atual
                const currentForm = cloneContainer.querySelector(`.clone-form-3:nth-child(${formIndex + 1})`);
                
                if (currentForm) {
                    // Preencher funcionário
                    const funcSelect = currentForm.querySelector('select[name="operator"]');
                    if (funcSelect) {
                        funcSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
                        data.funcionarios_disponiveis.forEach(f => {
                            const option = document.createElement('option');
                            option.value = f.id;
                            option.textContent = `${f.matricula} - ${f.nome}`;
                            if (f.id === func.funcionario_id) option.selected = true;
                            funcSelect.appendChild(option);
                        });
                    }
                    
                    // Preencher equipamento
                    const equipSelect = currentForm.querySelector('select[name="item"]');
                    if (equipSelect) {
                        equipSelect.innerHTML = '<option value="">Selecione um equipamento</option>';
                        data.equipamentos.forEach(e => {
                            const option = document.createElement('option');
                            option.value = e.id;
                            option.textContent = e.nome;
                            if (e.id === equip.equipamento_id) option.selected = true;
                            equipSelect.appendChild(option);
                        });
                    }
                    
                    // Preencher quantidade
                    const qtyInput = currentForm.querySelector('input[name="quantity"]');
                    if (qtyInput) qtyInput.value = equip.quantidade;
                    
                    // Preencher observações
                    const obsInput = currentForm.querySelector('textarea[name="observation"]');
                    if (obsInput) obsInput.value = equip.observacoes || '';
                    
                    // Configurar botão de remoção
                    const removeBtn = currentForm.querySelector('.remove-specific');
                    if (removeBtn) {
                        removeBtn.setAttribute('data-index', formIndex);
                    }

                    const formFields = currentForm.querySelector('.collapse');
                    if (formFields) {
                        formFields.setAttribute('id', `formFields-${formIndex}`);
                    }

                    const toggleCollapse = currentForm.querySelector('.toggle-collapse');
                    if (toggleCollapse) {
                        toggleCollapse.setAttribute('data-bs-target', `#formFields-${formIndex}`);
                    }

                    toggleCollapseFunction();
                }
                
                formIndex++;
            });
        });
    }
}