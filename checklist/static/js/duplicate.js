import { getCookie, ToastBottomEnd } from "../../../static/js/scripts.js";
import { carregarCardsChecklist, mostrarPlaceholdersCards } from "./cards-checklist.js";

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
      const checklistId = button.getAttribute('data-checklist-id');
      const nameInput = document.getElementById('checklistName');
      const checklistIdInput = document.getElementById('originalChecklistId');
      
      if (nameInput) {
        nameInput.value = 'Cópia de ' + checklistName;
      }
      
      if (checklistIdInput) {
        checklistIdInput.value = checklistId;
      }

      // 3. Carregar setores da API
      carregarSetores();
    });
  }

  // 4. Função para carregar setores da API
  function carregarSetores() {
    const sectorSelect = document.getElementById('sectorSelect');
    
    sectorSelect.innerHTML = '';

    // Mostrar loading no select
    const loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.textContent = 'Carregando setores...';
    loadingOption.disabled = true;
    loadingOption.selected = true;
    sectorSelect.appendChild(loadingOption);

    // Fazer requisição para a API de setores
    fetch('/api_setores/')
      .then(response => {
        if (!response.ok) {
          throw new Error('Erro ao carregar setores');
        }
        return response.json();
      })
      .then(data => {
        // Remover option de loading
        sectorSelect.remove(sectorSelect.options.length - 1);

        const optionDefault = document.createElement('option');
        optionDefault.value = '';
        optionDefault.textContent = 'Selecione um setor...';
        optionDefault.disabled = true;
        optionDefault.selected = true;
        sectorSelect.appendChild(optionDefault);

        // Popular o select com os setores
        if (data && data.length > 0) {
          data.forEach(setor => {
            const option = document.createElement('option');
            option.value = setor.id || setor.nome; // Use ID ou nome dependendo da API
            option.textContent = setor.nome;
            sectorSelect.appendChild(option);
          });
        } else {
          // Caso não haja setores
          const noDataOption = document.createElement('option');
          noDataOption.value = '';
          noDataOption.textContent = 'Nenhum setor disponível';
          noDataOption.disabled = true;
          sectorSelect.appendChild(noDataOption);
        }
      })
      .catch(error => {
        console.error('Erro ao carregar setores:', error);
        
        // Remover option de loading
        sectorSelect.remove(sectorSelect.options.length - 1);

        // Option de erro
        const errorOption = document.createElement('option');
        errorOption.value = '';
        errorOption.textContent = 'Erro ao carregar setores';
        errorOption.disabled = true;
        sectorSelect.appendChild(errorOption);

        ToastBottomEnd.fire({
            icon: 'error',
            title: 'Erro ao carregar setores'
        });
      });
  }

  // 5. Configurar o botão de confirmar duplicação
  const confirmDuplicateBtn = document.getElementById('confirmDuplicate');
  if (confirmDuplicateBtn) {
    confirmDuplicateBtn.addEventListener('click', function() {
      const checklistName = document.getElementById('checklistName').value;
      const originalChecklistId = document.getElementById('originalChecklistId').value;
      const sectorSelect = document.getElementById('sectorSelect');
      const selectedSector = sectorSelect.value;

      if (!checklistName || !selectedSector || selectedSector === '') {
        ToastBottomEnd.fire({
            icon: 'warning',
            title: 'Por favor, preencha todos os campos.'
        });
        return;
      }

      // Enviar requisição para duplicar
      duplicarChecklist(originalChecklistId, checklistName, selectedSector);
    });
  }

  // 6. Função para duplicar checklist
  function duplicarChecklist(originalId, novoNome, setorId) {
    mostrarPlaceholdersCards();

    fetch('/api/checklists/duplicate/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify({
        original_id: originalId,
        novo_nome: novoNome,
        setor_id: setorId
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        
        ToastBottomEnd.fire({
            icon: 'success',
            title: 'Checklist duplicado com sucesso!'
        });
    
        const modal = bootstrap.Modal.getInstance(document.getElementById('duplicateModal'));
        modal.hide();

      } else {
        ToastBottomEnd.fire({
            icon: 'error',
            title: 'Erro ao duplicar checklist: ' + data.message,
        });
      }
    })
    .catch(error => {
      console.error('Erro:', error);
      ToastBottomEnd.fire({
          icon: 'error',
          title: 'Erro ao duplicar checklist.',
      });
    }).finally(f => {
        carregarCardsChecklist();
    })
  }
});