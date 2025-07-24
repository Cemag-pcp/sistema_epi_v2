import { getCookie } from "../../../../static/js/scripts.js";
import { addSolicitacaoClone, removeSpecificSolicitacaoClone, preencherModalEdicaoSolicitacao } from "./modal_editar_solicitacao.js";
import { solicitacoesTable } from "../get_solicitacoes_home.js";
import { ToastBottomEnd } from "../../../../static/js/scripts.js";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-editar-solicitacao');
    const formCancelRequest = document.getElementById('form-cancelar-solicitacao');
    const salvarBtn = document.querySelector('.button-editar-solicitacao');
    const salvarBtnCancel = document.querySelector('.button-cancelar-solicitacao');
    const spinner = salvarBtn.querySelector('.spinner-border');
    const spinnerCancel = salvarBtnCancel.querySelector('.spinner-border');
    const addBtn = document.getElementById('add-clone-solicitacao');

    // Evento para abrir o modal e carregar os dados
    document.addEventListener('click', async function(event) {
        if (event.target.classList.contains('abrirModalEditarSolicitacao')) {
            const solicitacaoId = event.target.getAttribute('data-solicitacao');
            const modal = document.getElementById('modal-editar-solicitacao');
            modal.setAttribute('data-solicitacao', solicitacaoId);
            const modalInstance = new bootstrap.Modal(modal);
            
            try {
                Swal.fire({
                    title: 'Carregando...',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });
                
                // Fazer requisição GET para obter os dados da solicitação
                const response = await fetch(`/core/solicitacoes/${solicitacaoId}/`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    }
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.message || 'Erro ao carregar dados da solicitação');
                }
                
                // Preencher o modal com os dados recebidos
                await preencherModalEdicaoSolicitacao(data);
                
                Swal.close();
                // Mostrar o modal
                modalInstance.show();
                
            } catch (error) {
                Swal.close();
                console.error('Erro:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: error.message || 'Ocorreu um erro ao carregar os dados da solicitação',
                    confirmButtonText: 'OK'
                });
            }
        }
    });

    // Event listeners para os botões de adicionar/remover
    addBtn.addEventListener('click', function() {
        addSolicitacaoClone();
    });
    
    document.addEventListener('click', function(event) {
        if (event.target.closest('.remove-specific')) {
            const button = event.target.closest('.remove-specific');
            const indexToRemove = parseInt(button.getAttribute('data-index'));
            removeSpecificSolicitacaoClone(indexToRemove);
        }
    });

    // Evento de submit do formulário
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        spinner.style.display = 'inline-block';
        salvarBtn.disabled = true;
        
        try {
            const solicitacaoId = document.getElementById('modal-editar-solicitacao').getAttribute('data-solicitacao');
            const dadosSolicitacao = [];
            
            // Coletar dados de todos os formulários clonados
            document.querySelectorAll('.clone-form-solicitacao').forEach((formClone) => {
                const equipamentoId = formClone.querySelector('select[name="item"]').value;
                const funcionarioId = formClone.querySelector('select[name="operator"]').value;
                const quantidade = formClone.querySelector('input[name="quantity"]').value;
                const observacoes = formClone.querySelector('textarea[name="observation"]').value;
                const motivo = formClone.querySelector('select[name="reason"]').value;
                
                dadosSolicitacao.push({
                    equipamento_id: equipamentoId,
                    funcionario_id: funcionarioId,
                    quantidade: quantidade,
                    observacoes: observacoes,
                    motivo: motivo
                });
            });

            console.log(solicitacaoId);
            
            // Enviar para a API
            const response = await fetch(`/core/solicitacoes/${solicitacaoId}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    dados_solicitacao: dadosSolicitacao
                })
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
            bootstrap.Modal.getInstance(document.getElementById('modal-editar-solicitacao')).hide();

            solicitacoesTable.ajax.reload(null, false);
            
        } catch (error) {
            ToastBottomEnd.fire({
                icon: 'error',
                title: error.message || 'Erro ao atualizar solicitação'
            });
        } finally {
            spinner.style.display = 'none';
            salvarBtn.disabled = false;
        }
    });

    formCancelRequest.addEventListener('submit', async function(event) {
        event.preventDefault();
        spinnerCancel.style.display = 'inline-block';
        salvarBtnCancel.disabled = true;
        
        try {
            const solicitacaoId = document.getElementById('modal-cancelar-solicitacao').getAttribute('data-solicitacao');
            
            // Enviar para a API
            const response = await fetch(`/core/solicitacoes/${solicitacaoId}/`, {
                method: 'PATCH',
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
            bootstrap.Modal.getInstance(document.getElementById('modal-cancelar-solicitacao')).hide();

            solicitacoesTable.ajax.reload(null, false);
            
        } catch (error) {
            ToastBottomEnd.fire({
                icon: 'error',
                title: error.message || 'Erro ao atualizar solicitação'
            });
        } finally {
            spinnerCancel.style.display = 'none';
            salvarBtnCancel.disabled = false;
        }
    });
});