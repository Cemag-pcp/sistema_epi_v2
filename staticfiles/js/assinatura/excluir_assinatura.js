import { getCookie } from "../../../../static/js/scripts.js";
import { solicitacoesTable } from "../get_solicitacoes_home.js";
import { ToastBottomEnd } from "../../../../static/js/scripts.js";

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
            const action = event.target.getAttribute('data-action');
            const modalCancelarSolicitacao = document.getElementById("modal-cancelar-solicitacao");
            
            const modalTitle = document.getElementById('modal-cancelar-solicitacao-title');
            const modalBodyText = modalCancelarSolicitacao.querySelector('.modal-body p');
            const buttonCancelarSolicitacao = modalCancelarSolicitacao.querySelector('.button-cancelar-solicitacao');
            
            if (action === 'reabrir') {
                modalTitle.textContent = 'Reabrir Solicitação';
                modalBodyText.textContent = `Tem certeza que deseja reabrir a solicitação?`;
                buttonCancelarSolicitacao.querySelector('.text-button').textContent = 'Reabrir';
                buttonCancelarSolicitacao.classList.remove('btn-danger');
                buttonCancelarSolicitacao.classList.add('btn-success');
            } else {
                modalTitle.textContent = 'Excluir Solicitação';
                modalBodyText.textContent = `Tem certeza que deseja Excluir a solicitação?`;
                buttonCancelarSolicitacao.querySelector('.text-button').textContent = 'Cancelar';
                buttonCancelarSolicitacao.classList.remove('btn-success');
                buttonCancelarSolicitacao.classList.add('btn-danger');
            }
            
            modalCancelarSolicitacao.setAttribute('data-solicitacao', idDadosSolicitacao);
            modalCancelarSolicitacao.setAttribute('data-action', action);

            const modal = new bootstrap.Modal(modalCancelarSolicitacao);
            modal.show();
        }
    });

    document.addEventListener('submit', async function (event) {

        if (event.target.id === 'form-excluir-assinatura') {
            const submitButton = event.target.querySelector('.button-excluir-assinatura');
            const spinner = submitButton.querySelector('.spinner-border');

            try {
                event.preventDefault();
                const modal = document.getElementById('modal-excluir-assinatura');
                const solicitacaoId = modal.getAttribute('data-solicitacao');

                spinner.style.display = 'inline-block';
                submitButton.disabled = true;
                
                // Enviar para a API
                const response = await fetch(`/core/assinatura/${solicitacaoId}/`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.message || 'Erro ao atualizar solicitação');
                }
                
                ToastBottomEnd.fire({
                    icon: 'success',
                    title: 'Solicitação atualizada com sucesso!'
                });
                
                // Fechar o modal e recarregar a página ou tabela
                bootstrap.Modal.getInstance(document.getElementById('modal-excluir-assinatura')).hide();
    
                solicitacoesTable.ajax.reload(null, false);
                
            } catch (error) {
                ToastBottomEnd.fire({
                    icon: 'error',
                    title: error.message || 'Erro ao atualizar solicitação'
                });
            } finally {
                spinner.style.display = 'none';
                submitButton.disabled = false;
            }
        }
    });
})