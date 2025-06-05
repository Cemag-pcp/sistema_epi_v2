import { getCookie } from "../../../static/js/scripts.js";
import { addCloneForm, removeSpecificClone, preencherModalEdicao } from "./edit-padroes/utils.js";
import { table } from "./datatable-padroes.js";

// CREATE PADROES

document.addEventListener('DOMContentLoaded', () => {
    const abrirModalBtn = document.getElementById('abrirModalPadroes');
    const modal = new bootstrap.Modal(document.getElementById('modal-criar-padrao'));
    const salvarBtn = document.getElementById('salvarPadrao');
    const criarSolicitarBtn = document.getElementById('criarSolicitarPadrao');
    const spinner = salvarBtn.querySelector('.spinner-border');
    const spinnerRequest = criarSolicitarBtn.querySelector('.spinner-border');
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
        modal.show();
    });

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        spinner.style.display = 'inline-block';
        spinnerRequest.style.display = 'inline-block';
        salvarBtn.disabled = true;
        criarSolicitarBtn.disabled = true;
        
        // Coletar dados básicos do padrão
        const nomePadrao = form.querySelector('input[name="padrao_name"]').value;
        const setorId = form.querySelector('select[name="padrao_setor"]').value;
        
        // Estrutura para agrupar equipamentos por funcionário
        const funcionariosMap = new Map();
        
        // Coletar dados de todos os formulários clonados
        document.querySelectorAll('.clone-form-2').forEach((formClone, index) => {
            const funcionarioId = formClone.querySelector('.funcionario').value;
            const equipamentoId = formClone.querySelector('.equipamento').value;
            const quantidade = formClone.querySelector('.quantidade').value;
            const observacao = formClone.querySelector('.observacao').value;
            const motivo = formClone.querySelector('.motivo').value;
            
            // Criar estrutura agrupada por funcionário
            if (!funcionariosMap.has(funcionarioId)) {
                funcionariosMap.set(funcionarioId, {
                    funcionario_id: funcionarioId,
                    equipamentos: []
                });
            }
            
            funcionariosMap.get(funcionarioId).equipamentos.push({
                equipamento_id: equipamentoId,
                quantidade: quantidade,
                observacoes: observacao,
                motivo: motivo
            });
        });
        
        // Converter Map para array
        const funcionariosData = Array.from(funcionariosMap.values());
        
        // Dados completos para envio
        const payload = {
            nome: nomePadrao,
            setor_id: setorId,
            funcionarios: funcionariosData
        };
        
        // Enviar para a API
        fetch('/padroes/api/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(response.message || 'Erro ao criar padrão');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                Toast.fire({
                    icon: 'success',
                    title: 'Padrão criado com sucesso!'
                });
                table.ajax.reload();
                if (event.submitter.classList.contains('criar-solicitar')) {
                    window.location = `/solicitacao/?padrao=${data.padrao_id}`
                } else {
                    modal.hide();
                }
            } else {
                throw new Error(data.message || 'Erro ao criar padrão');
            }
        })
        .catch(error => {
            Toast.fire({
                icon: 'error',
                title: error.message || 'Erro ao salvar padrão'
            });
        })
        .finally(() => {
            spinner.style.display = 'none';
            salvarBtn.disabled = false;
            spinnerRequest.style.display = 'none';
            criarSolicitarBtn.disabled = false;
        });
    });
});

// UPDATE PADROES

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-editar-padrao');
    const solicitarBtn = document.getElementById('editar-solicitar-padrao');
    const salvarBtn = document.getElementById('editarPadrao');
    const spinner = salvarBtn.querySelector('.spinner-border');
    const spinnerEditar = solicitarBtn.querySelector('.spinner-border');
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
            const modal = document.getElementById('modal-editar-padrao');
            modal.setAttribute('data-id', padraoId);
            const modalInstance = new bootstrap.Modal(modal);
            
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
                modalInstance.show();
                
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
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        const modal = bootstrap.Modal.getInstance(document.getElementById('modal-editar-padrao')); 
        spinner.style.display = 'inline-block';
        salvarBtn.disabled = true;
        spinnerEditar.style.display = 'inline-block';
        solicitarBtn.disabled = true;
        
        // Coletar todos os formulários clonados
        const forms = document.querySelectorAll('.clone-form-3');
        const padraoId = document.querySelector('#modal-editar-padrao').getAttribute('data-id');
        const padraoNome = document.getElementById('padrao_name_edit').value;
        const requests = [];
        
        // Processar cada formulário
        forms.forEach((form, index) => {
            const item = form.querySelector('select[name="item"]').value;
            const operator = form.querySelector('select[name="operator"]').value;
            const quantity = form.querySelector('input[name="quantity"]').value;
            const observation = form.querySelector('textarea[name="observation"]').value;
            const motivo = form.querySelector('select[name="reason"]').value;
            
            requests.push({
                item_id: item, // ou apenas item se for o nome
                operator_id: operator,
                quantity: quantity,
                observation: observation,
                motivo: motivo
            });
        });
        
        // Dados para enviar
        const data = {
            padrao_nome: padraoNome,
            padrao_id: padraoId,
            requests: requests
        };

        console.log(data)
        
        // Enviar para o backend (substitua pela sua URL real)
        fetch(`/padroes/${padraoId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') // Adicione esta função se necessário
            },
            body: JSON.stringify(data)
        })
        .then(async response => {
            const responseData = await response.json(); // Sempre tentar parsear o JSON
    
            if (!response.ok) {
                // Usar a mensagem do backend se disponível, caso contrário mensagem genérica
                throw new Error(responseData.message || `Erro na requisição: ${response.status}`);
            }
            
            return responseData;
        })
        .then(data => {
            
            if (data.success) {
                Toast.fire({
                    icon: 'success',
                    title: 'Padrão atualizado com sucesso!'
                });
                table.ajax.reload();
                if (event.submitter.classList.contains('editar-solicitar')) {
                    window.location = `/solicitacao/?padrao=${data.padrao_id}`
                } else {
                    modal.hide();
                }
            } else {
                Toast.fire({
                    icon: 'error',
                    title: data.message || 'Erro ao atualizar padrão'
                });
            }
        })
        .catch(error => {
            Toast.fire({
                icon: 'error',
                title: error.message || 'Ocorreu um erro ao carregar os dados do padrão',
            });
            console.error('Error:', error);
        })
        .finally(f => {
            spinner.style.display = 'none';
            salvarBtn.disabled = false;
            spinnerEditar.style.display = 'none';
            solicitarBtn.disabled = false;
        })
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
          
          const response = await fetch(`/padroes/${id}/`, {
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
            Toast.fire({
                icon: 'success',
                title: 'Status do padrão alterado com sucesso!'
            });
            modal.hide();
            table.ajax.reload();
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