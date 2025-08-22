import { getCookie, ToastBottomEnd, toggleSpinner } from "../../../static/js/scripts.js";

document.addEventListener('DOMContentLoaded', function() {
  // Variáveis globais
  let questions = [];
  let currentEditingId = null;
  
  // Elementos do DOM
  const questionsContainer = document.getElementById('questions-container');
  const noQuestionsMessage = document.getElementById('no-questions-message');
  const questionTemplate = document.getElementById('question-template');
  const questionsCount = document.getElementById('questions-count');
  const totalQuestions = document.getElementById('total-questions');
  
  // Função para atualizar contagem de perguntas
  function updateQuestionsCount() {
    const count = questions.length;
    questionsCount.textContent = count;
    totalQuestions.textContent = count;
    
    if (count > 0) {
      noQuestionsMessage.classList.add('d-none');
    } else {
      noQuestionsMessage.classList.remove('d-none');
    }
  }
  
  // Função para renderizar perguntas
  function renderQuestions() {
    questionsContainer.innerHTML = '';
    
    if (questions.length === 0) {
      noQuestionsMessage.classList.remove('d-none');
      return;
    }
    
    noQuestionsMessage.classList.add('d-none');
    
    questions.forEach((question, index) => {
      const questionElement = questionTemplate.cloneNode(true);
      questionElement.id = `question-${question.id}`;
      questionElement.classList.remove('d-none');
      
      questionElement.querySelector('.question-number').textContent = index + 1;
      questionElement.querySelector('.question-text').textContent = question.text;
      
      if (question.description) {
        const descElement = questionElement.querySelector('.question-description');
        descElement.textContent = question.description;
        descElement.classList.remove('d-none');
      }
      
      // Configurar botões
      questionElement.querySelector('.edit-question-btn').addEventListener('click', () => {
        currentEditingId = question.id;
        document.getElementById('edit-question-text').value = question.text;
        document.getElementById('edit-question-description').value = question.description || '';
        
        const modal = new bootstrap.Modal(document.getElementById('editQuestionModal'));
        modal.show();
      });
      
      questionElement.querySelector('.delete-question-btn').addEventListener('click', () => {
          questions = questions.filter(q => q.id !== question.id);
          renderQuestions();
          updateQuestionsCount();
      });
      
      questionsContainer.appendChild(questionElement);
    });
  }
  
  // Adicionar nova pergunta
  document.getElementById('add-question-btn').addEventListener('click', function() {
    const text = document.getElementById('question-text').value.trim();
    const description = document.getElementById('question-description').value.trim();
    
    if (!text) {
      ToastBottomEnd.fire({
          icon: 'warning',
          title: 'O texto da pergunta é obrigatório',
      });
      return;
    }
    
    const newQuestion = {
      id: Date.now().toString(),
      text: text,
      description: description,
      required: true
    };
    
    questions.push(newQuestion);
    renderQuestions();
    updateQuestionsCount();
    
    // Limpar campos
    document.getElementById('question-text').value = '';
    document.getElementById('question-description').value = '';
    document.getElementById('question-text').focus();
  });
  
  // Salvar pergunta editada
  document.getElementById('save-edited-question-btn').addEventListener('click', function() {
    const text = document.getElementById('edit-question-text').value.trim();
    const description = document.getElementById('edit-question-description').value.trim();
    
    if (!text) {
      ToastBottomEnd.fire({
          icon: 'warning',
          title: 'O texto da pergunta é obrigatório',
      });
      return;
    }
    
    const questionIndex = questions.findIndex(q => q.id === currentEditingId);
    if (questionIndex !== -1) {
      questions[questionIndex].text = text;
      questions[questionIndex].description = description;
      renderQuestions();
    }
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('editQuestionModal'));
    modal.hide();
  });
  
  // Salvar checklist via API
  document.getElementById('save-checklist-btn').addEventListener('click', async function() {
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const setorId = document.getElementById('setor').value;
    
    const errors = [];
    
    if (!title) errors.push('O título do checklist é obrigatório');
    if (questions.length === 0) errors.push('Pelo menos uma pergunta é necessária');
    
    if (errors.length > 0) {
      ToastBottomEnd.fire({
          icon: 'error',
          title: errors.join('\n'),
      });
      return;
    }
    
    try {
      toggleSpinner('save-checklist-btn', true);
      
      // Preparar dados para envio
      const checklistData = {
        nome: title,
        descricao: description,
        setor_id: setorId || null,
        perguntas: questions.map(q => ({
          texto: q.text,
          descricao: q.description || ""
        }))
      };
      
      // Enviar para a API
      const response = await fetch('/api/checklists/add/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(checklistData)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar checklist');
      }
      
      // Mostrar mensagem de sucesso
      ToastBottomEnd.fire({
          icon: 'success',
          title: 'Checklist criado com sucesso!',
      });
      
      // Redirecionar para a página de checklists
      window.location.href = '/checklists/';
      
    } catch (error) {
      console.error('Erro:', error);
      ToastBottomEnd.fire({
          icon: 'success',
          title: 'Erro ao salvar checklist: ' + error.message,
      });
      
      toggleSpinner('save-checklist-btn', false);
    }
  });
  
  // Inicializar
  updateQuestionsCount();
});