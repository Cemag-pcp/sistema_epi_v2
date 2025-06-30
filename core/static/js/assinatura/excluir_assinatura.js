document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('abrirModalExcluirAssinatura')) {
            const idDadosSolicitacao = event.target.getAttribute('data-id');
            const modalExcluirAssinatura = document.getElementById("modal-excluir-assinatura");

            const modal = new bootstrap.Modal(modalExcluirAssinatura);
            modal.show();
        }
    });
})