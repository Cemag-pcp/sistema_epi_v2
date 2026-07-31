import { getCookie } from '/static/js/scripts.js';
import { adicionarLinhaTabela } from './addRow.js';
import { table, inicializarDataTable } from './datatable-equipamentos.js';
import { ToastBottomEnd } from '../../../static/js/scripts.js';

// CREATE EQUIPAMENTS

document.addEventListener('DOMContentLoaded', () => {
    const abrirModalBtn = document.getElementById('abrirModalEquipamento');
    const modal = new bootstrap.Modal(document.getElementById('modal-criar-equipamento'));
    const salvarBtn = document.getElementById('salvarEquipamento');
    const spinner = salvarBtn.querySelector('.spinner-border');
    const form = document.getElementById('form-criar-equipamento');
    const vidaUtilInput = document.getElementById('vida-util-equipamento');

    function toggleVidaUtil(temVidaUtil) {
        vidaUtilInput.disabled = !temVidaUtil;
        vidaUtilInput.required = temVidaUtil;
        if (!temVidaUtil) vidaUtilInput.value = '';
    }

    document.querySelectorAll('.tem-vida-util-radio').forEach(radio => {
        radio.addEventListener('change', () => toggleVidaUtil(radio.value === 'sim'));
    });

    abrirModalBtn.addEventListener('click', () => {
        form.reset();
        document.getElementById('tem-vida-util-sim').checked = true;
        toggleVidaUtil(true);
        modal.show();
    });

    form.addEventListener('submit', async (event) => {
        try {
            event.preventDefault();
            spinner.style.display = 'inline-block';
            salvarBtn.disabled = true;

            const temVidaUtil = document.getElementById('tem-vida-util-sim').checked;

            const formData = {
                nome: document.getElementById('nome-equipamento').value,
                codigo: document.getElementById('codigo-equipamento').value,
                tem_vida_util: temVidaUtil,
                vida_util_dias: temVidaUtil ? document.getElementById('vida-util-equipamento').value : null,
                ca: document.getElementById('ca-equipamento').value,
                ativo: document.getElementById('status-equipamento').checked
            };
            
            const response = await fetch('/equipamento/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();

            if (!response.ok) {
                const errorMsg = data.message ||
                               (data.errors && (data.errors.codigo || data.errors.vida_util_dias)) ||
                               (data.errors ? JSON.stringify(data.errors) : 'Erro desconhecido');
                throw new Error(errorMsg);
            }
            
            if (data.success) {
                modal.hide();
                
                adicionarLinhaTabela(data.equipamento, tabelaEquipamentos);
              
                ToastBottomEnd.fire({
                    icon: 'success',
                    title: 'Equipamento criado com sucesso!'
                });
                
            } else {
                throw new Error(data.message || 'Erro ao criar equipamento');
            }
            
        } catch (error) {
            console.error('Erro ao criar:', error);
            
            ToastBottomEnd.fire({
                icon: 'error',
                title: error.message || 'Erro ao criar equipamento',
                footer: typeof error.message === 'object' ? JSON.stringify(error.message) : null
            });
            
        } finally {
            spinner.style.display = 'none';
            salvarBtn.disabled = false;
        }
    });
});

// READ EQUIPAMENTS

// PUT EQUIPAMENTS

document.addEventListener('DOMContentLoaded', () => {

  const modal = new bootstrap.Modal(document.getElementById('modal-editar-equipamento'));
  const salvarBtn = document.getElementById('editarEquipamento');
  const spinner = salvarBtn.querySelector('.spinner-border');
  const editVidaUtilInput = document.getElementById('edit-vida-util-equipamento');

  function toggleEditVidaUtil(temVidaUtil) {
      editVidaUtilInput.disabled = !temVidaUtil;
      if (!temVidaUtil) editVidaUtilInput.value = '';
  }

  document.querySelectorAll('.edit-tem-vida-util-radio').forEach(radio => {
      radio.addEventListener('change', () => toggleEditVidaUtil(radio.value === 'sim'));
  });

  document.addEventListener('click', function (event) {
    if (event.target.classList.contains('abrirModalEditarEquipamento')) {

      const id = event.target.getAttribute('data-id');
      const nome = event.target.getAttribute('data-nome');
      const codigo = event.target.getAttribute('data-codigo');
      const temVidaUtil = event.target.getAttribute('data-tem-vida-util') === 'true';
      const vidaUtil = event.target.getAttribute('data-vida-util-dias');
      const ca = event.target.getAttribute('data-ca');

      salvarBtn.setAttribute('data-id', id);
      document.getElementById('edit-nome-equipamento').value = nome
      document.getElementById('edit-codigo-equipamento').value = codigo
      document.getElementById(temVidaUtil ? 'edit-tem-vida-util-sim' : 'edit-tem-vida-util-nao').checked = true;
      toggleEditVidaUtil(temVidaUtil);
      document.getElementById('edit-vida-util-equipamento').value = temVidaUtil ? vidaUtil : ''
      document.getElementById('edit-ca-equipamento').value = ca

      modal.show();
    }
  });

  salvarBtn.addEventListener('click', async () => {
      try {
          const temVidaUtilRadio = document.querySelector('.edit-tem-vida-util-radio:checked');
          if (!temVidaUtilRadio) {
              ToastBottomEnd.fire({
                  icon: 'warning',
                  title: 'Informe se o equipamento tem vida útil'
              });
              return;
          }

          if (temVidaUtilRadio.value === 'sim' && !(parseInt(editVidaUtilInput.value) > 0)) {
              ToastBottomEnd.fire({
                  icon: 'warning',
                  title: 'A vida útil deve ser maior que 0'
              });
              return;
          }

          spinner.style.display = 'inline-block';
          salvarBtn.disabled = true;

          const id = salvarBtn.getAttribute('data-id');
          const temVidaUtil = temVidaUtilRadio.value === 'sim';
          const formData = {
              nome: document.getElementById('edit-nome-equipamento').value,
              codigo: document.getElementById('edit-codigo-equipamento').value,
              tem_vida_util: temVidaUtil,
              vida_util_dias: temVidaUtil ? document.getElementById('edit-vida-util-equipamento').value : null,
              ca: document.getElementById('edit-ca-equipamento').value,
          };

          const response = await fetch(`/equipamento/${id}/`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'X-CSRFToken': getCookie('csrftoken'),
                  'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify(formData)
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

              const row = document.querySelector(`tr[data-id="${id}"]`);

              if (row) {
                  // Atualiza cada célula com os novos valores
                  row.querySelector('.nome-equipamento').textContent = data.data.nome;
                  row.querySelector('.codigo-equipamento').textContent = `Código ${data.data.codigo}`;
                  row.querySelector('.vida-util-equipamento').textContent = data.data.tem_vida_util
                      ? `${data.data.vida_util_dias} dias`
                      : 'Não controla';
                  row.querySelector('.ca-equipamento').textContent = data.data.ca;

                  const attributes = row.querySelector('.abrirModalEditarEquipamento')
                  attributes.setAttribute('data-nome', data.data.nome)
                  attributes.setAttribute('data-codigo', data.data.codigo)
                  attributes.setAttribute('data-ca', data.data.ca)
                  attributes.setAttribute('data-tem-vida-util', data.data.tem_vida_util)
                  attributes.setAttribute('data-vida-util-dias', data.data.vida_util_dias)

                  // Adiciona efeito visual para destacar a atualização
                  row.style.backgroundColor = '#e8f5e9'; // Verde claro
                  setTimeout(() => {
                      row.style.backgroundColor = '';
                  }, 1000);
              }
              
              ToastBottomEnd.fire({
                  icon: 'success',
                  title: 'Equipamento atualizado com sucesso!'
              });
              
          } else {
              throw new Error(data.message || 'Erro ao atualizar equipamento');
          }
          
      } catch (error) {
          console.error(error.response);
          console.log(error.response);

          ToastBottomEnd.fire({
              icon: 'error',
              title: error.message || 'Erro ao atualizar equipamento'
          });
          
      } finally {
          spinner.style.display = 'none';
          salvarBtn.disabled = false;
      }
  });
});

// PATCH STATUS EQUIPAMENTS

document.addEventListener('DOMContentLoaded', () => {
    
  const modal = new bootstrap.Modal(document.getElementById('modal-desativar-equipamento'));
  const descricao = document.getElementById('equipamento-desativado');
  const salvarBtn = document.getElementById('desativarEquipamento');
  const spinner = salvarBtn.querySelector('.spinner-border');
  
  document.addEventListener('click', function (event) {
    if (event.target.classList.contains('abrirModalDesativarEquipamento')) { 
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
          
          const response = await fetch(`/equipamento/${id}/`, {
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
              if ($.fn.DataTable.isDataTable('#tabelaEquipamentos')) {
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
                  
                  ToastBottomEnd.fire({
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
          ToastBottomEnd.fire({
              icon: 'error',
              title: error.message || 'Erro ao atualizar equipamento'
          });
      } finally {
          spinner.style.display = 'none';
          salvarBtn.disabled = false;
      }
  });
});
