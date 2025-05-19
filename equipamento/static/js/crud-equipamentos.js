
// CREATE EQUIPAMENTS

document.addEventListener('DOMContentLoaded', () => {
    
  const abrirModalBtn = document.getElementById('abrirModalEquipamento');
  const modal = new bootstrap.Modal(document.getElementById('modal-criar-equipamento'));
  const salvarBtn = document.getElementById('salvarEquipamento');
  const spinner = salvarBtn.querySelector('.spinner-border');
  
  abrirModalBtn.addEventListener('click', () => {
    modal.show();
  });
  
  salvarBtn.addEventListener('click', async () => {
    try {
      spinner.style.display = 'inline-block';
      salvarBtn.disabled = true;
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      modal.hide();

    } catch (error) {
      console.error('Erro ao salvar:', error);
      
    } finally {
      spinner.style.display = 'none';
      salvarBtn.disabled = false;
    }
  });
});

// READ EQUIPAMENTS

// UPDATE EQUIPAMENTS

document.addEventListener('DOMContentLoaded', () => {
  
  const modal = new bootstrap.Modal(document.getElementById('modal-editar-equipamento'));
  const salvarBtn = document.getElementById('editarEquipamento');
  const spinner = salvarBtn.querySelector('.spinner-border');
  
  document.addEventListener('click', function (event) {
    if (event.target.classList.contains('abrirModalEditarEquipamento')) { 

      const id = event.target.getAttribute('data-id');
      const nome = event.target.getAttribute('data-nome');
      const codigo = event.target.getAttribute('data-codigo');
      const vidaUtil = event.target.getAttribute('data-vida-util-dias');
      const ca = event.target.getAttribute('data-ca');
      const status = event.target.getAttribute('data-status');

      document.getElementById('edit-id-equipamento').value = id
      document.getElementById('edit-nome-equipamento').value = nome
      document.getElementById('edit-codigo-equipamento').value = codigo
      document.getElementById('edit-vida-util-equipamento').value = vidaUtil
      document.getElementById('edit-ca-equipamento').value = ca
      document.getElementById('edit-status-equipamento').value = status

      modal.show();
    }
  });
  
  salvarBtn.addEventListener('click', async () => {
    try {
      spinner.style.display = 'inline-block';
      salvarBtn.disabled = true;
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      modal.hide();

    } catch (error) {
      console.error('Erro ao salvar:', error);
      
    } finally {
      spinner.style.display = 'none';
      salvarBtn.disabled = false;
    }
  });
});

// DELETE EQUIPAMENTS

document.addEventListener('DOMContentLoaded', () => {
    
  const modal = new bootstrap.Modal(document.getElementById('modal-desativar-equipamento'));
  const salvarBtn = document.getElementById('desativarEquipamento');
  const spinner = salvarBtn.querySelector('.spinner-border');
  
  document.addEventListener('click', function (event) {
    if (event.target.classList.contains('abrirModalDesativarEquipamento')) { 
      modal.show();
    }
  });
  
  salvarBtn.addEventListener('click', async () => {
    try {
      spinner.style.display = 'inline-block';
      salvarBtn.disabled = true;
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      modal.hide();

    } catch (error) {
      console.error('Erro ao salvar:', error);
      
    } finally {
      spinner.style.display = 'none';
      salvarBtn.disabled = false;
    }
  });
});
