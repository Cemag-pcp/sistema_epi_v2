let verificationAbortController = null;

// Função independente para atualizar motivos
function atualizarMotivos(isPrimeiraEntrega, motivoSelect) {
    motivoSelect.innerHTML = '';

    if (isPrimeiraEntrega) {
        const option = document.createElement('option');
        option.value = 'primeira entrega';
        option.textContent = 'Primeira Entrega';
        motivoSelect.appendChild(option);
        motivoSelect.value = option.value;
    } else {
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
    }
}

// Função independente para handleChange
async function handleChange({ funcionarioSelect, equipamentoSelect, motivoSelect }) {
    motivoSelect.innerHTML = "";

    const defaultMotivoOption = document.createElement('option');
    defaultMotivoOption.value = "";
    defaultMotivoOption.textContent = "Carregando...";
    defaultMotivoOption.selected = true;
    defaultMotivoOption.disabled = true;
    defaultMotivoOption.hidden = true;
    motivoSelect.appendChild(defaultMotivoOption);

    // Cancela a requisição anterior se existir
    if (verificationAbortController) {
        verificationAbortController.abort();
    }

    if (funcionarioSelect.value && equipamentoSelect.value) {
        // Cria um novo controller para a requisição atual
        verificationAbortController = new AbortController();
        
        try {
            const existe = await verificarMultiplosEquipamentos(
                [{funcionario_id: funcionarioSelect.value, equipamento_id: equipamentoSelect.value}],
                verificationAbortController.signal
            );
            const chave = `${funcionarioSelect.value}_${equipamentoSelect.value}`;
            atualizarMotivos(!existe[chave], motivoSelect);
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Erro ao verificar equipamentos:', error);
            }
        }
    }
    
    defaultMotivoOption.textContent = "Selecione um motivo..."
}

// Configura os listeners de change
export function setupChangeListeners() {
    $(document).off('change', '.funcionario, .equipamento');
    
    $(document).on('change', '.funcionario, .equipamento', function() {
        const form = this.closest('.clone-form-1');
        const funcionarioSelect = form.querySelector('.funcionario');
        const equipamentoSelect = form.querySelector('.equipamento');
        const motivoSelect = form.querySelector('.motivo');
        
        handleChange({ funcionarioSelect, equipamentoSelect, motivoSelect });
    });
}

export function loadFormDataRequest() {
    setupChangeListeners();
    
    const form = document.getElementById("form-card-solict");
    const spinner = document.getElementById("spinner");
    const funcionarioSelect = document.querySelector('.funcionario');
    const equipamentoSelect = document.querySelector('.equipamento');
    const motivoSelect = document.querySelector('.motivo');

    form.style.display = 'none';
    spinner.style.display = 'block';

    // Limpa e adiciona opções padrão
    [funcionarioSelect, equipamentoSelect, motivoSelect].forEach(select => {
        select.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = `Selecione um ${select.classList.contains('funcionario') ? 'funcionário' : 
                                  select.classList.contains('equipamento') ? 'equipamento' : 'motivo'}`;
        defaultOption.selected = true;
        defaultOption.hidden = true;
        if (select === motivoSelect) defaultOption.disabled = true;
        select.appendChild(defaultOption);
    });

    fetch('/solicitacao/api')
        .then(response => response.json())
        .then(data => {
            // Preencher equipamentos
            data.equipamentos.forEach(equipamento => {
                const option = document.createElement('option');
                option.value = equipamento.id;
                option.textContent = `${equipamento.codigo} - ${equipamento.nome}`;
                equipamentoSelect.appendChild(option);
            });

            // Preencher funcionários
            data.funcionarios.forEach(funcionario => {
                const option = document.createElement('option');
                option.value = funcionario.id;
                option.textContent = `${funcionario.matricula} - ${funcionario.nome}`;
                funcionarioSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar dados:', error);
        })
        .finally(() => {
            form.style.display = 'block';
            spinner.style.display = 'none';
        });
}

// Função para verificar múltiplos equipamentos
export async function verificarMultiplosEquipamentos(pares, signal = null) {
    try {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        };
        if (signal) {
            options.signal = signal;
        }
        
        const response = await fetch(
            `/solicitacao/verificar-equipamentos/?pares=${encodeURIComponent(JSON.stringify(pares))}`,
            options
        );
        
        if (!response.ok) throw new Error('Erro na verificação');
        return await response.json();
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Erro ao verificar equipamentos:', error);
            return Object.fromEntries(
                pares.map(par => [`${par.funcionario_id}_${par.equipamento_id}`, false])
            );
        }
        throw error;
    }
}