document.addEventListener('DOMContentLoaded', function() {
    const selectElement = document.getElementById('padrao-select');
    
    // 1. Lógica inicial para tratar query da URL
    const urlParams = new URLSearchParams(window.location.search);
    const queryValue = urlParams.get('padrao');
    
    if (queryValue) {
        const optionToSelect = selectElement.querySelector(`option[value="${queryValue}"]`);
        if (optionToSelect) {
            optionToSelect.selected = true;
            getPadroes(selectElement, queryValue);
        }
    }
    
    // 2. Listener para mudanças manuais
    selectElement.addEventListener('change', function() {
        const selectedValue = this.value;
        if (selectedValue) {
            getPadroes(this, selectedValue);
        }
    });
});

function getPadroes(select, value) {
    // Faz requisição ao backend
    fetch(`/solicitacao/padroes/?id=${value}`, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('Resposta do backend:', data);
        // Aqui você pode processar a resposta do servidor
    })
    .catch(error => {
        console.error('Erro na requisição:', error);
    });
}