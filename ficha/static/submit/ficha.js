document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-ficha');
    const button = document.getElementById('filtrar-ficha');
    const spinner = document.getElementById('loading-spinner');
    const searchIcon = document.getElementById('search-icon-glass');
    const selectFicha = document.getElementById('select-ficha');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        searchIcon.classList.add('hidden-icon');
        spinner.style.display = 'inline-block';
        button.disabled = true;

        fetch(`/ficha/${selectFicha.value}/`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro na requisição');
                }
                return response.blob();  // Recebe o arquivo como blob
            })
            .then(blob => {
                // Cria um link temporário para download
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Ficha_EPI_${selectFicha.options[selectFicha.selectedIndex].text}.xlsx`;
                document.body.appendChild(a);
                a.click();
                
                // Limpa o objeto URL
                window.URL.revokeObjectURL(url);
                a.remove();
            })
            .catch(error => {
                console.error('Erro:', error);
                alert('Ocorreu um erro ao gerar a ficha. Por favor, tente novamente.');
            })
            .finally(() => {
                searchIcon.classList.remove('hidden-icon');
                spinner.style.display = 'none';
                button.disabled = false;
            });
    });
});