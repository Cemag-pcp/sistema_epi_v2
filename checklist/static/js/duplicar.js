document.addEventListener('DOMContentLoaded', function() {
  // 1. Impedir que o clique no botão de duplicar ative o link do card
  document.querySelectorAll('.duplicate-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
    });
  });

  // 2. Configurar o modal com os dados do checklist
  const duplicateModal = document.getElementById('duplicateModal');
  if (duplicateModal) {
    duplicateModal.addEventListener('show.bs.modal', function(event) {
      const button = event.relatedTarget; // Botão que acionou o modal
      const checklistName = button.getAttribute('data-checklist-name');
      const nameInput = document.getElementById('checklistName');
      
      if (nameInput) {
        nameInput.value = 'Cópia de ' + checklistName;
      }
    });
  }
});