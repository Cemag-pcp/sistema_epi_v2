export function loadFormDataRequest() {
    const form = document.getElementById("form-card-solict");
    const spinner = document.getElementById("spinner");
    const funcionarioSelect = document.querySelector('.funcionario');
    const equipamentoSelect = document.querySelector('.equipamento');
    const motivoSelect = document.querySelector('.motivo');

    form.style.display = 'none';
    spinner.style.display = 'block';

    // Limpa os selects e adiciona a opção padrão
    funcionarioSelect.innerHTML = '';
    equipamentoSelect.innerHTML = '';
    motivoSelect.innerHTML = '';
    
    // Adiciona a opção padrão "Selecione..."
    const defaultFuncionarioOption = document.createElement('option');
    defaultFuncionarioOption.value = "";
    defaultFuncionarioOption.textContent = "Selecione um funcionário";
    defaultFuncionarioOption.selected = true;
    defaultFuncionarioOption.disabled = true;
    defaultFuncionarioOption.hidden = true;
    funcionarioSelect.appendChild(defaultFuncionarioOption);

    const defaultEquipamentoOption = document.createElement('option');
    defaultEquipamentoOption.value = "";
    defaultEquipamentoOption.textContent = "Selecione um equipamento";
    defaultEquipamentoOption.selected = true;
    defaultEquipamentoOption.disabled = true;
    defaultEquipamentoOption.hidden = true;
    equipamentoSelect.appendChild(defaultEquipamentoOption);

    const defaultMotivoOption = document.createElement('option');
    defaultMotivoOption.value = "";
    defaultMotivoOption.textContent = "Selecione um motivo";
    defaultMotivoOption.selected = true;
    defaultMotivoOption.disabled = true;
    defaultMotivoOption.hidden = true;
    motivoSelect.appendChild(defaultMotivoOption);

    // Função para atualizar os motivos baseado na condição
    const atualizarMotivos = (isPrimeiraEntrega) => {
        motivoSelect.innerHTML = '';
        motivoSelect.appendChild(defaultMotivoOption);

        if (isPrimeiraEntrega) {
            // Adiciona apenas primeira entrega
            const option = document.createElement('option');
            option.value = 'primeira entrega';
            option.textContent = 'Primeira Entrega';
            motivoSelect.appendChild(option);
            motivoSelect.value = option.value;
        } else {
            // Adiciona os outros motivos
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
    };

    // Event listener para quando ambos funcionário e equipamento são selecionados
    const handleChange = async () => {
        motivoSelect.innerHTML = "";

        const defaultMotivoOption = document.createElement('option');
        defaultMotivoOption.value = "";
        defaultMotivoOption.textContent = "Carregando...";
        defaultMotivoOption.selected = true;
        defaultMotivoOption.disabled = true;
        defaultMotivoOption.hidden = true;
        motivoSelect.appendChild(defaultMotivoOption);

        if (funcionarioSelect.value && equipamentoSelect.value) {
            const existe = await verificarMultiplosEquipamentos([
                {funcionario_id: funcionarioSelect.value, equipamento_id: equipamentoSelect.value}
            ]);
            const chave = `${funcionarioSelect.value}_${equipamentoSelect.value}`;
            atualizarMotivos(!existe[chave]);
        }
        defaultMotivoOption.textContent = "Selecione um motivo..."
    };

    funcionarioSelect.addEventListener('change', handleChange);
    equipamentoSelect.addEventListener('change', handleChange);

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

// Nova função para verificar múltiplos equipamentos de uma vez
export async function verificarMultiplosEquipamentos(pares) {
    try {
        const response = await fetch(`/solicitacao/verificar-equipamentos/?pares=${encodeURIComponent(JSON.stringify(pares))}`);
        if (!response.ok) throw new Error('Erro na verificação');
        return await response.json();
    } catch (error) {
        console.error('Erro ao verificar equipamentos:', error);
        // Retorna um objeto com todos os pares como false em caso de erro
        return Object.fromEntries(
            pares.map(par => [`${par.funcionario_id}_${par.equipamento_id}`, false])
        );
    }
}