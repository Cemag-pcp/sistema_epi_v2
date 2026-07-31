document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-ficha');
    const button = document.getElementById('filtrar-ficha');
    const spinner = document.getElementById('loading-spinner');
    const searchIcon = document.getElementById('search-icon-glass');
    const selectFicha = document.getElementById('select-ficha');
    const erroDiv = document.getElementById('ficha-erro');

    function mostrarErro(msg) {
        erroDiv.textContent = msg;
        erroDiv.classList.remove('d-none');
    }

    function limparErro() {
        erroDiv.textContent = '';
        erroDiv.classList.add('d-none');
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        limparErro();

        searchIcon.classList.add('hidden-icon');
        spinner.style.display = 'inline-block';
        button.disabled = true;

        fetch(`/ficha/${selectFicha.value}/`)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || 'Erro ao gerar a ficha.');
                    });
                }
                return response.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Ficha_EPI_${selectFicha.options[selectFicha.selectedIndex].text}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            })
            .catch(error => {
                mostrarErro(error.message || 'Ocorreu um erro ao gerar a ficha. Tente novamente.');
            })
            .finally(() => {
                searchIcon.classList.remove('hidden-icon');
                spinner.style.display = 'none';
                button.disabled = false;
            });
    });
});