import { getCookie } from "../../../static/js/scripts.js";
import { addCloneForm, removeSpecificClone, preencherModalEdicao } from "./edit-padroes/utils.js";

// CREATE PADROES

document.addEventListener('DOMContentLoaded', () => {
    const abrirModalBtn = document.getElementById('abrirModalPadroes');
    const modal = new bootstrap.Modal(document.getElementById('modal-criar-padrao'));
    const salvarBtn = document.getElementById('salvarPadrao');
    const spinner = salvarBtn.querySelector('.spinner-border');
    const form = document.getElementById('form-criar-padrao');
    const Toast = Swal.mixin({
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.onmouseenter = Swal.stopTimer;
            toast.onmouseleave = Swal.resumeTimer;
        }
    });

    abrirModalBtn.addEventListener('click', () => {
        form.reset();
        modal.show();
    });
});

// UPDATE PADROES

document.addEventListener('DOMContentLoaded', () => {
    const modal = new bootstrap.Modal(document.getElementById('modal-editar-padrao'));
    const salvarBtn = document.getElementById('editarPadrao');
    const spinner = salvarBtn.querySelector('.spinner-border');
    const addBtn = document.getElementById('add-clone-3');

    // Configuração do Toast
    const Toast = Swal.mixin({
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.onmouseenter = Swal.stopTimer;
            toast.onmouseleave = Swal.resumeTimer;
        }
    });

    // Evento para abrir o modal e carregar os dados
    document.addEventListener('click', async function(event) {
        if (event.target.classList.contains('abrirModalEditarPadrao')) {
            const padraoId = event.target.getAttribute('data-id');
            const modal = new bootstrap.Modal(document.getElementById('modal-editar-padrao'));
            
            try {

                Swal.fire({
                    title: 'Carregando...',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });
                
                // Fazer requisição GET para obter os dados do padrão
                const response = await fetch(`/padroes/${padraoId}/`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    }
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.message || 'Erro ao carregar dados do padrão');
                }
                
                console.log(data)
                // Preencher o modal com os dados recebidos
                await preencherModalEdicao(data);
                
                Swal.close();
                // Mostrar o modal
                modal.show();
                
            } catch (error) {
                Swal.close();
                console.error('Erro:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: error.message || 'Ocorreu um erro ao carregar os dados do padrão',
                    confirmButtonText: 'OK'
                });
            }
        }
    });

    // Event listeners para os botões de adicionar/remover
    addBtn.addEventListener('click', addCloneForm);
    document.addEventListener('click', function(event) {
        if (event.target.closest('.remove-specific')) {
            const button = event.target.closest('.remove-specific');
            const indexToRemove = parseInt(button.getAttribute('data-index'));
            removeSpecificClone(indexToRemove);
        }
    });

    // Evento para salvar as alterações
    salvarBtn.addEventListener('click', function() {
        spinner.style.display = 'inline-block';
        salvarBtn.disabled = true;
        
        // Simular envio (substitua por sua lógica real)
        setTimeout(() => {
            spinner.style.display = 'none';
            salvarBtn.disabled = false;
            modal.hide();
            
            Toast.fire({
                icon: 'success',
                title: 'Padrão atualizado com sucesso!'
            });
        }, 1500);
    });
});

// DELETE PADROES

document.addEventListener('DOMContentLoaded', () => {
    
  const modal = new bootstrap.Modal(document.getElementById('modal-desativar-padrao'));
  const descricao = document.getElementById('padrao-desativado');
  const salvarBtn = document.getElementById('desativarPadrao');
  const spinner = salvarBtn.querySelector('.spinner-border');
  const Toast = Swal.mixin({
      toast: true,
      position: "bottom-end",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
      }
  });
  
  document.addEventListener('click', function (event) {
    if (event.target.classList.contains('abrirModalDesativarPadrao')) { 
        const id = event.target.getAttribute('data-id');
        descricao.textContent = event.target.getAttribute('data-nome');
        salvarBtn.setAttribute('data-id', id);
        modal.show();
    }
  });
  
  salvarBtn.addEventListener('click', async () => {
      try {
          spinner.style.display = 'inline-block';
          salvarBtn.disabled = true;
          
          const id = salvarBtn.getAttribute('data-id');
          
          const response = await fetch(`/padrao/${id}/`, {
              method: 'PATCH',
              headers: {
                  'Content-Type': 'application/json',
                  'X-CSRFToken': getCookie('csrftoken'),
                  'X-Requested-With': 'XMLHttpRequest'
              },
          });
          
          const data = await response.json();

          if (!response.ok) {
              // Extrai a mensagem de erro detalhada do backend
              const errorMsg = data.message || 
                              data.detail || 
                              (data.errors ? JSON.stringify(data.errors) : 'Erro desconhecido');
              throw new Error(errorMsg);
          }

          if (data.success) {
              modal.hide();
              if ($.fn.DataTable.isDataTable('#tabelaPadrao')) {
                  table.destroy();
              }
              const row = document.querySelector(`tr[data-id="${id}"]`);
              if (row) {
                  const statusCell = row.querySelector('.status');
                  const badgeSpan = statusCell.querySelector('.badge');

                  if (data.novo_status) {
                      badgeSpan.textContent = 'Ativo';
                      badgeSpan.classList.remove('status-declined');
                      badgeSpan.classList.add('status-approved');
                      badgeSpan.classList.remove('badge-danger');
                      badgeSpan.classList.add('badge-success');
                  } else {
                      badgeSpan.textContent = 'Desativado';
                      badgeSpan.classList.remove('status-approved');
                      badgeSpan.classList.add('status-declined');
                      badgeSpan.classList.remove('badge-success');
                      badgeSpan.classList.add('badge-danger');
                  }
                  
                  Toast.fire({
                      icon: 'success',
                      title: 'Item deletado com sucesso!'
                  });
                        
                  // Atualiza o atributo data-order para manter a ordenação correta
                  statusCell.setAttribute('data-order', data.novo_status.toString());
                  inicializarDataTable();
              }
          } else {
              throw new Error(data.message || 'Erro ao atualizar equipamento');
          }
          
      } catch (error) {
          console.error(error);
          Toast.fire({
              icon: 'error',
              title: error.message || 'Erro ao atualizar equipamento'
          });
      } finally {
          spinner.style.display = 'none';
          salvarBtn.disabled = false;
      }
  });
});