
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
    
  const abrirModalBtn = document.getElementById('abrirModalEditarEquipamento');
  const modal = new bootstrap.Modal(document.getElementById('modal-editar-equipamento'));
  const salvarBtn = document.getElementById('editarEquipamento');
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

// DELETE EQUIPAMENTS

document.addEventListener('DOMContentLoaded', () => {
    
  const abrirModalBtn = document.getElementById('abrirModalDesativarEquipamento');
  const modal = new bootstrap.Modal(document.getElementById('modal-desativar-equipamento'));
  const salvarBtn = document.getElementById('desativarEquipamento');
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
