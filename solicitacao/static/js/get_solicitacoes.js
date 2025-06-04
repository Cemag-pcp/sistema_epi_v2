export function loadFormDataRequest() {

    const form = document.getElementById("form-card-solict");
    const spinner = document.getElementById("spinner");
    form.style.display = 'none';
    spinner.style.display = 'block';

    fetch('/solicitacao/api')
        .then(response => response.json())
        .then(data => {
            // Preencher equipamentos
            const equipamentoSelect = document.querySelector('.equipamento');
            data.equipamentos.forEach(equipamento => {
                const option = document.createElement('option');
                option.value = equipamento.id;
                option.textContent = `${equipamento.codigo} - ${equipamento.nome}`;
                equipamentoSelect.appendChild(option);
            });

            // Preencher funcionários
            const funcionarioSelect = document.querySelector('.funcionario');
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