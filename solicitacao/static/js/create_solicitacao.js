import { getCookie } from "../../../static/js/scripts.js";

document.getElementById('form-card-solict').addEventListener("submit", (event) => {
    event.preventDefault();

    const equipamentos = document.querySelectorAll('.equipamento');
    const quantidades = document.querySelectorAll('.quantidade');
    const funcionarios = document.querySelectorAll('.funcionario');
    const observacoes = document.querySelectorAll('.observacoes');
    const motivos = document.querySelectorAll('.motivo');
    
    const listaSolicitacoes = [];

    console.log(equipamentos); // Agora você tem um array de objetos no formato desejado

    // Itera sobre os elementos (assumindo que todos têm o mesmo número de itens)
    for (let i = 0; i < equipamentos.length; i++) {
        const solicitacao = {
            'equipamento': equipamentos[i]?.value || '', // Usa optional chaining e fallback
            'quantidades': parseInt(quantidades[i]?.value) || 1, // Converte para número, padrão 1
            'funcionarios': funcionarios[i]?.value || '',
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
        body: JSON.stringify(listaSolicitacoes)
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
    })
    .catch(error => {
        console.error('Erro na requisição:', error);
        alert('Erro ao carregar dados do padrão');
    })
})