document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('abrirModalExcluirAssinatura')) {
            const idDadosSolicitacao = event.target.getAttribute('data-id');
            const modalExcluirAssinatura = document.getElementById("modal-excluir-assinatura");

            modalExcluirAssinatura.setAttribute('data-solicitacao', idDadosSolicitacao);

            const modal = new bootstrap.Modal(modalExcluirAssinatura);
            modal.show();
        }

        if (event.target.classList.contains('abrirModalCancelarSolicitacao')) {
            const idDadosSolicitacao = event.target.getAttribute('data-id');
            const modalCancelarSolicitacao = document.getElementById("modal-cancelar-solicitacao");

            modalCancelarSolicitacao.setAttribute('data-solicitacao', idDadosSolicitacao);

            const modal = new bootstrap.Modal(modalCancelarSolicitacao);
            modal.show();
        }
    });
})