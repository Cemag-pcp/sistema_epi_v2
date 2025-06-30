import { getCookie } from "../../../static/js/scripts.js";
import { resetFormData } from "./get_padroes_solicitacao.js";

document.getElementById('form-card-solict').addEventListener("submit", (event) => {
    event.preventDefault();

    // Mostrar spinner e desativar botão
    const submitButton = document.getElementById("submit-button");
    const buttonText = document.getElementById("button-text");
    const buttonSpinner = document.getElementById("button-spinner");
    
    submitButton.disabled = true;
    buttonText.textContent = "Enviando...";
    buttonSpinner.classList.remove("d-none");

    const equipamentos = document.querySelectorAll('.equipamento');
    const quantidades = document.querySelectorAll('.quantidade');
    const funcionarios = document.querySelectorAll('.funcionario');
    const observacoes = document.querySelectorAll('.observacoes');
    const motivos = document.querySelectorAll('.motivo');
    let padrao = document.getElementById('padrao-select'); 
    const padraoSelecionado = padrao.value; 
    
    const listaSolicitacoes = [];

    for (let i = 0; i < equipamentos.length; i++) {
        const solicitacao = {
            'equipamento_id': equipamentos[i]?.value || '',
            'quantidades': parseInt(quantidades[i]?.value) || 1,
            'funcionario_id': funcionarios[i]?.value || '',
            'observacoes': observacoes[i]?.value || '',
            'motivos': motivos[i]?.value || ''
        };
        listaSolicitacoes.push(solicitacao);
    }

    fetch('/solicitacao/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({'itens': listaSolicitacoes, 'padrao': padraoSelecionado})
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
        resetFormData();
        padrao.value = "";
    })
    .catch(error => {
        console.error('Erro na requisição:', error);
        alert('Erro ao enviar solicitação');
    })
    .finally(() => {
        // Restaurar botão independente do resultado
        submitButton.disabled = false;
        buttonText.textContent = "Criar Solicitação";
        buttonSpinner.classList.add("d-none");
    });
});