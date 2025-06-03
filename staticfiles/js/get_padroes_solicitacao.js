import { loadFormDataRequest } from "./get_solicitacoes.js";

document.addEventListener('DOMContentLoaded', function() {
    const selectElement = document.getElementById('padrao-select');
    
    // 1. Lógica inicial para tratar query da URL
    const urlParams = new URLSearchParams(window.location.search);
    const queryValue = urlParams.get('padrao');
    
    if (queryValue) {
        const optionToSelect = selectElement.querySelector(`option[value="${queryValue}"]`);
        if (optionToSelect) {
            optionToSelect.selected = true;
            getPadroes(queryValue);
        }
    } else {
        loadFormDataRequest();
    }
    
    // 2. Listener para mudanças manuais
    selectElement.addEventListener('change', function() {
        const selectedValue = this.value;
        if (selectedValue) {
            getPadroes(selectedValue);
        } else {
            loadFormDataRequest();
            const cloneContainer = document.getElementById('clone-container-1');
            const form = document.getElementById('form-card-solict');
            const originalForm = cloneContainer.querySelector('.clone-form-1');            
            cloneContainer.innerHTML = '';
            cloneContainer.appendChild(originalForm);
            form.reset();
        }
    });
});

function getPadroes(value) {
   
    const form = document.getElementById("form-card-solict");
    const spinner = document.getElementById("spinner");
    form.style.display = 'none';
    spinner.style.display = 'block';

    fetch(`/padroes/${value}`, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(data);
            updateAvailableOptions(data.equipamentos, data.funcionarios_disponiveis);
            fillPadraoData(data.padrao);
        } else {
            alert(data.message || 'Erro ao carregar padrão');
        }
    })
    .catch(error => {
        console.error('Erro na requisição:', error);
        alert('Erro ao carregar dados do padrão');
    })
    .finally(finnaly => {
        form.style.display = 'block';
        spinner.style.display = 'none';
    })
}

function fillPadraoData(padraoData) {
    const cloneContainer = document.getElementById('clone-container-1');
    const originalForm = cloneContainer.querySelector('.clone-form-1');
    
    // Limpar todos os formulários clonados, mantendo apenas o original
    cloneContainer.innerHTML = '';
    cloneContainer.appendChild(originalForm);
    
    // Se não houver funcionários, manter apenas o formulário original vazio
    if (padraoData.funcionarios.length === 0) return;
    
    // Preencher dados básicos do padrão (apenas no primeiro formulário)
    const nomeInput = originalForm.querySelector('input[name="nome"]');
    if (nomeInput) nomeInput.value = padraoData.nome || '';
    
    const setorSelect = originalForm.querySelector('select[name="setor"]');
    if (setorSelect) setorSelect.value = padraoData.setor_id || '';
    
    // Criar um formulário para cada equipamento de cada funcionário
    let formIndex = 0;
    padraoData.funcionarios.forEach(funcionario => {
        funcionario.equipamentos.forEach(equipamento => {
            let form;
            
            if (formIndex === 0) {
                form = originalForm;
            } else {
                form = originalForm.cloneNode(true);
                
                cloneContainer.appendChild(form);
            }
            
            // Atualizar o número da solicitação
            const requestText = form.querySelector(".request");
            if (requestText) {
                requestText.textContent = `${formIndex + 1}ª Solicitação`;
            }
            
            // Preencher dados do funcionário
            const funcionarioSelect = form.querySelector('.funcionario');
            if (funcionarioSelect) {
                funcionarioSelect.value = funcionario.funcionario_id;
            }
            
            // Preencher dados do equipamento
            const equipamentoSelect = form.querySelector('.equipamento');
            if (equipamentoSelect) {
                equipamentoSelect.value = equipamento.equipamento_id;
            }
            
            const quantidadeInput = form.querySelector('.quantidade');
            if (quantidadeInput) {
                quantidadeInput.value = equipamento.quantidade;
            }
            
            const motivoSelect = form.querySelector('.motivo');
            if (motivoSelect) {
                motivoSelect.value = equipamento.motivo;
            }
            
            const observacoesTextarea = form.querySelector('.observacoes');
            if (observacoesTextarea) {
                observacoesTextarea.value = equipamento.observacoes || '';
            }
            
            formIndex++;
        });
    });
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
}