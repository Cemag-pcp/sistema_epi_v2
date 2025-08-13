import { loadFormDataRequest, verificarMultiplosEquipamentos, setupChangeListeners } from "./get_solicitacoes.js";
import { updateRequestNumbers } from "../../../static/js/clone.js";
import { ToastBottomEnd } from "../../../static/js/scripts.js";

let abortController = null;
let activeRequests = 0;

document.addEventListener('DOMContentLoaded', function() {
    const selectElement = document.getElementById('padrao-select');
    const urlParams = new URLSearchParams(window.location.search);
    const queryValue = urlParams.get('padrao');

    // Initialize Select2 after setting the initial value
    if (queryValue) {
        const optionToSelect = selectElement.querySelector(`option[value="${queryValue}"]`);
        if (optionToSelect) {
            optionToSelect.selected = true;
        }
    } else {
        // Explicitly select the empty value option
        selectElement.querySelector('option[value=""]').selected = true;
    }

    // Now initialize Select2
    $(selectElement).select2();
    
    // Rest of your logic...
    if (queryValue) {
        getPadroes(queryValue);
    } else {
        loadFormDataRequest();
    }
    
    $(selectElement).on('change', function() {
        const selectedValue = this.value;
        if (abortController) {
            abortController.abort();
        }
        if (selectedValue) {
            getPadroes(selectedValue);
        } else {
            resetFormData();
        }
    });
});

function getPadroes(value) {
    const form = document.getElementById("form-card-solict");
    const spinner = document.getElementById("spinner");
    
    // Mostra o spinner apenas na primeira requisição ativa
    if (activeRequests === 0) {
        form.style.display = 'none';
        spinner.style.display = 'block';
    }
    
    activeRequests++; // Incrementa o contador
    
    // Cria um novo AbortController para a requisição atual
    abortController = new AbortController();
    
    fetch(`/padroes/${value}`, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
        },
        signal: abortController.signal
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        }
        throw new Error('Erro na requisição');
    })
    .then(async data => {
        if (data.success) {
            updateAvailableOptions(data.equipamentos, data.funcionarios_disponiveis);
            await fillPadraoData(data.padrao);
        } else {
            ToastBottomEnd.fire({
                icon: 'error',
                title: data.message || 'Erro ao carregar padrão',
            });
        }
    })
    .catch(error => {
        // Ignora erros causados pelo abort
        if (error.name !== 'AbortError') {
            console.error('Erro na requisição:', error);
            ToastBottomEnd.fire({
                icon: 'error',
                title: 'Erro ao carregar dados do padrão',
            });
        }
    })
    .finally(() => {
        activeRequests--; // Decrementa o contador
        
        // Esconde o spinner apenas quando não houver mais requisições ativas
        if (activeRequests === 0) {
            form.style.display = 'block';
            spinner.style.display = 'none';
        }
        
        // Limpa o controlador apenas se for o último
        if (activeRequests === 0) {
            abortController = null;
        }
    });
}

async function fillPadraoData(padraoData) {
    $(document).off('change', '.funcionario, .equipamento');

    const cloneContainer = document.getElementById('clone-container-1');
    const originalForm = cloneContainer.querySelector('.clone-form-1');
    
    // Limpar clones existentes
    while (cloneContainer.children.length > 1) {
        cloneContainer.removeChild(cloneContainer.lastChild);
    }
    
    // Resetar formulário original
    const inputs = originalForm.querySelectorAll("input, textarea, select");
    inputs.forEach(input => {
        if (input.tagName === "SELECT") {
            input.selectedIndex = 0;
        } else if (input.type !== "submit") {
            if(!input.classList.contains('requestName')){
                input.value = "";
            }
        }
    });
    
    // Atualizar número da solicitação
    const requestText = originalForm.querySelector(".request");
    if (requestText) {
        requestText.textContent = "1ª Solicitação";
    }

    if (padraoData.funcionarios.length === 0) {
        setupChangeListeners();
        return;
    }
    
    if (padraoData.funcionarios.length === 0) return;
    
    // Preencher dados básicos
    const nomeInput = originalForm.querySelector('input[name="nome"]');
    if (nomeInput) nomeInput.value = padraoData.nome || '';
    
    const setorSelect = originalForm.querySelector('select[name="setor"]');
    if (setorSelect) setorSelect.value = padraoData.setor_id || '';
    
    // Preparar lista de pares para verificação
    const paresParaVerificar = [];
    for (const funcionario of padraoData.funcionarios) {
        for (const equipamento of funcionario.equipamentos) {
            paresParaVerificar.push({
                funcionario_id: funcionario.funcionario_id,
                equipamento_id: equipamento.equipamento_id
            });
        }
    }
    
    // Fazer uma única chamada para verificar todos os pares
    const verificacoes = await verificarMultiplosEquipamentos(paresParaVerificar);
    
    // Criar formulários com os resultados
    let formIndex = 0;
    for (const funcionario of padraoData.funcionarios) {
        for (const equipamento of funcionario.equipamentos) {
            let form;
            
            if (formIndex === 0) {
                form = originalForm;
            } else {
                // Destruir todos os Select2 (incluindo o original)
                $(originalForm).find('select.select2').each(function() {
                    if ($(this).hasClass("select2-hidden-accessible")) {
                        $(this).select2('destroy');
                    }
                });
                
                form = originalForm.cloneNode(true);

                const removeBtn = form.querySelector(".btn-outline-danger");
                if (removeBtn) {
                    removeBtn.addEventListener("click", function() {
                        if (cloneContainer.querySelectorAll('.clone-form-1').length > 1) {
                            form.remove();
                            updateRequestNumbers(cloneContainer, 'clone-form-1');
                        } else {
                            Swal.fire({
                                icon: 'warning',
                                title: 'Você não pode remover a última solicitação!',
                                toast: true,
                                position: "bottom-end",
                                showConfirmButton: false,
                                timer: 3000
                            });
                        }
                    });
                }
                
                cloneContainer.appendChild(form);

                $(originalForm).find('select.select2').each(function() {
                    const $select = $(this);
                    
                    $select.select2({
                        width: '100%'
                    });
                });
                
                $(form).find('select.select2').each(function() {
                    const $select = $(this);
                    
                    $select.select2({
                        width: '100%'
                    });
                });
            }
            
            // Atualizar número da solicitação
            const requestText = form.querySelector(".request");
            if (requestText) {
                requestText.textContent = `${formIndex + 1}ª Solicitação`;
            }
            
            // Preencher dados
            const funcionarioSelect = form.querySelector('.funcionario');
            if (funcionarioSelect) {
                funcionarioSelect.value = funcionario.funcionario_id;
                $(funcionarioSelect).trigger('change');
            }
            
            const equipamentoSelect = form.querySelector('.equipamento');
            if (equipamentoSelect) {
                equipamentoSelect.value = equipamento.equipamento_id;
                $(equipamentoSelect).trigger('change');
            }
            
            const quantidadeInput = form.querySelector('.quantidade');
            if (quantidadeInput) {
                quantidadeInput.value = equipamento.quantidade;
            }
            
            // Preencher motivos baseado na verificação prévia
            const motivoSelect = form.querySelector('.motivo');
            if (motivoSelect) {
                motivoSelect.innerHTML = '';
                
                const chave = `${funcionario.funcionario_id}_${equipamento.equipamento_id}`;
                const existe = verificacoes[chave];
                
                if (existe) {
                    const motivos = [
                        {value: 'substituicao', text: 'Substituição'},
                        {value: 'perda', text: 'Perda'},
                        {value: 'dano', text: 'Dano'}
                    ];
                    
                    motivos.forEach(motivo => {
                        const option = document.createElement('option');
                        option.value = motivo.value;
                        option.textContent = motivo.text;
                        motivoSelect.appendChild(option);
                    });

                    if (equipamento.motivo) {
                        motivoSelect.value = equipamento.motivo;
                    }

                    console.log(equipamento.motivo)
                } else {
                    const option = document.createElement('option');
                    option.value = 'primeira entrega';
                    option.textContent = 'Primeira Entrega';
                    motivoSelect.appendChild(option);
                    motivoSelect.value = option.value;
                }
            }
            
            const observacoesTextarea = form.querySelector('.observacoes');
            if (observacoesTextarea) {
                observacoesTextarea.value = equipamento.observacoes || '';
            }
            
            formIndex++;
        }
    }
    
    setupChangeListeners();
}

function updateAvailableOptions(equipamentos, funcionarios) {
    // Atualizar select de funcionários em todos os formulários
    const funcionarioSelects = document.querySelectorAll('.funcionario');
    funcionarioSelects.forEach(select => {
        // Limpar opções existentes
        select.innerHTML = '';
        
        // Adicionar opção vazia
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Selecione um funcionário';
        select.appendChild(emptyOption);
        
        // Adicionar funcionários disponíveis
        funcionarios.forEach(funcionario => {
            const option = document.createElement('option');
            option.value = funcionario.id;
            option.textContent = `${funcionario.matricula} - ${funcionario.nome}`;
            select.appendChild(option);
        });
    });

    const equipamentoSelects = document.querySelectorAll('.equipamento');
    equipamentoSelects.forEach(select => {
        // Limpar opções existentes
        select.innerHTML = '';
        
        // Adicionar opção vazia
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Selecione um equipamento';
        select.appendChild(emptyOption);
        
        // Adicionar funcionários disponíveis
        equipamentos.forEach(equipamento => {
            const option = document.createElement('option');
            option.value = equipamento.id;
            option.textContent = `${equipamento.codigo} - ${equipamento.nome}`;
            select.appendChild(option);
        });
    });
}

export function resetFormData() {
    // Remove listeners antigos primeiro
    $(document).off('change', '.funcionario, .equipamento');
    
    // Reseta o container
    const cloneContainer = document.getElementById('clone-container-1');
    const originalForm = cloneContainer.querySelector('.clone-form-1');            
    cloneContainer.innerHTML = '';
    cloneContainer.appendChild(originalForm);
    
    // Reseta o form sem disparar eventos
    const form = document.getElementById('form-card-solict');
    form.reset();
    
    // Carrega os dados novamente (agora com apenas um listener)
    loadFormDataRequest();
}