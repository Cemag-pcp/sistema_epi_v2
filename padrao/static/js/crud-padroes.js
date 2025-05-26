import { getCookie } from "../../../static/js/scripts.js";


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

document.addEventListener('DOMContentLoaded', () => {
    const modal = new bootstrap.Modal(document.getElementById('modal-editar-padrao'));
    const salvarBtn = document.getElementById('editarPadrao');
    const spinner = salvarBtn.querySelector('.spinner-border');
    const cloneContainer = document.getElementById('clone-container-3');
    const addBtn = document.getElementById('add-clone-3');
    const removeBtn = document.getElementById('remove-last-3');

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

    // Função para adicionar novo formulário clonado
    function addCloneForm() {
        const originals = cloneContainer.querySelectorAll('.clone-form-3');
        const lastOriginal = originals[originals.length - 1];
        const clone = lastOriginal.cloneNode(true);

        // Atualiza o número da solicitação
        const requestText = clone.querySelector('.request');
        if (requestText) {
            const cloneNumber = originals.length + 1;
            requestText.textContent = `${cloneNumber}ª Solicitação do Padrão`;
        }

        // Limpa os valores dos inputs
        const inputs = clone.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.tagName === 'SELECT') {
                input.selectedIndex = 0;
            } else if (input.type !== 'submit') {
                input.value = '';
            }
        });

        cloneContainer.appendChild(clone);
    }

    // Função para remover o último formulário clonado
    function removeLastClone() {
        const clones = cloneContainer.querySelectorAll('.clone-form-3');
        if (clones.length > 1) {
            cloneContainer.removeChild(clones[clones.length - 1]);
        } else {
            Toast.fire({
                icon: 'warning',
                title: 'Não é possível remover o primeiro formulário.'
            });
        }
    }

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

async function preencherModalEdicao(data) {
    const modalTitle = document.querySelector('#modal-editar-padrao .modal-title');
    const cloneContainer = document.getElementById('clone-container-3');
    
    // Limpar clones existentes (exceto o primeiro)
    const clones = cloneContainer.querySelectorAll('.clone-form-3');
    clones.forEach((clone, index) => {
        if (index > 0) {
            cloneContainer.removeChild(clone);
        }
    });
    
    // Atualizar título do modal
    modalTitle.textContent = `Editar ${data.padrao.nome}`;

    document.querySelectorAll('.nome-solicitante-padrao-edit').forEach(field => {
        field.value = data.solicitante;
    });
    
    // Preencher o primeiro formulário
    const firstForm = cloneContainer.querySelector('.clone-form-3');
    
    if (firstForm) {
        // Preencher select de equipamentos
        const itemSelect = firstForm.querySelector('select[name="item"]');
        if (itemSelect) {
            itemSelect.innerHTML = ''; // Limpar opções existentes
            data.equipamentos.forEach(equip => {
                const option = document.createElement('option');
                option.value = equip.id;
                option.textContent = equip.nome;
                itemSelect.appendChild(option);
            });
        }
        
        // Preencher select de funcionários
        const funcionarioSelect = firstForm.querySelector('select[name="operator"]');
        if (funcionarioSelect) {
            funcionarioSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
            data.funcionarios_disponiveis.forEach(func => {
                const option = document.createElement('option');
                option.value = func.id;
                option.textContent = `${func.matricula} - ${func.nome}`;
                funcionarioSelect.appendChild(option);
            });
        }
        
        // Se houver funcionários no padrão, preencher o primeiro
        if (data.padrao.funcionarios.length > 0) {
            const primeiroFunc = data.padrao.funcionarios[0];
            
            if (funcionarioSelect) {
                funcionarioSelect.value = primeiroFunc.funcionario_id;
            }
            
            // Preencher equipamentos do primeiro funcionário
            if (primeiroFunc.equipamentos.length > 0 && itemSelect) {
                itemSelect.value = primeiroFunc.equipamentos[0].equipamento_id;
                const quantityInput = firstForm.querySelector('input[name="quantity"]');
                if (quantityInput) quantityInput.value = primeiroFunc.equipamentos[0].quantidade;
            }
        }
        
        // Adicionar formulários para os demais funcionários
        for (let i = 1; i < data.padrao.funcionarios.length; i++) {
            addCloneForm();
            const newForm = cloneContainer.querySelector(`.clone-form-3:nth-child(${i + 1})`);
            
            if (newForm) {
                const func = data.padrao.funcionarios[i];
                
                // Preencher funcionário
                const funcSelect = newForm.querySelector('select[name="operator"]');
                if (funcSelect) {
                    funcSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
                    data.funcionarios_disponiveis.forEach(f => {
                        const option = document.createElement('option');
                        option.value = f.id;
                        option.textContent = `${f.matricula} - ${f.nome}`;
                        if (f.id === func.funcionario_id) option.selected = true;
                        funcSelect.appendChild(option);
                    });
                }
                
                // Preencher equipamentos
                const equipSelect = newForm.querySelector('select[name="item"]');
                if (equipSelect) {
                    equipSelect.innerHTML = '';
                    data.equipamentos.forEach(equip => {
                        const option = document.createElement('option');
                        option.value = equip.id;
                        option.textContent = equip.nome;
                        equipSelect.appendChild(option);
                    });
                    
                    if (func.equipamentos.length > 0) {
                        equipSelect.value = func.equipamentos[0].equipamento_id;
                        const qtyInput = newForm.querySelector('input[name="quantity"]');
                        if (qtyInput) qtyInput.value = func.equipamentos[0].quantidade;
                    }
                }
            }
        }
    }
}


// Event listeners para os botões de adicionar/remover
addBtn.addEventListener('click', addCloneForm);
removeBtn.addEventListener('click', removeLastClone);

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