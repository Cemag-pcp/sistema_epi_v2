export function loadFormDataRequest() {
    const form = document.getElementById("form-card-solict");
    const spinner = document.getElementById("spinner");
    const funcionarioSelect = document.querySelector('.funcionario');
    const equipamentoSelect = document.querySelector('.equipamento');

    form.style.display = 'none';
    spinner.style.display = 'block';

    // Limpa os selects e adiciona a opção padrão
    funcionarioSelect.innerHTML = '';
    equipamentoSelect.innerHTML = '';
    
    // Adiciona a opção padrão "Selecione..."
    const defaultFuncionarioOption = document.createElement('option');
    defaultFuncionarioOption.value = "";
    defaultFuncionarioOption.textContent = "Selecione um funcionário";
    funcionarioSelect.appendChild(defaultFuncionarioOption);

    const defaultEquipamentoOption = document.createElement('option');
    defaultEquipamentoOption.value = "";
    defaultEquipamentoOption.textContent = "Selecione um equipamento";
    equipamentoSelect.appendChild(defaultEquipamentoOption);

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
        .finally(finnaly => {
            form.style.display = 'block';
            spinner.style.display = 'none';
        })
}