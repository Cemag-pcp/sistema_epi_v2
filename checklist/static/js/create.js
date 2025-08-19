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
        if (confirm('Tem certeza que deseja excluir esta pergunta?')) {
          questions = questions.filter(q => q.id !== question.id);
          renderQuestions();
          updateQuestionsCount();
        }
      });
      
      questionsContainer.appendChild(questionElement);
    });
  }
  
  // Adicionar nova pergunta
  document.getElementById('add-question-btn').addEventListener('click', function() {
    const text = document.getElementById('question-text').value.trim();
    const description = document.getElementById('question-description').value.trim();
    
    if (!text) {
      alert('O texto da pergunta é obrigatório');
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
      alert('O texto da pergunta é obrigatório');
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
  
  // Salvar checklist
  document.getElementById('save-checklist-btn').addEventListener('click', function() {
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const errors = [];
    
    if (!title) errors.push('O título do checklist é obrigatório');
    if (!description) errors.push('A descrição do checklist é obrigatória');
    if (questions.length === 0) errors.push('Pelo menos uma pergunta é necessária');
    
    if (errors.length > 0) {
      // Aqui você pode exibir os erros de validação
      alert(errors.join('\n'));
      return;
    }
    
    // Criar objeto do checklist
    const checklistId = title.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    const checklistData = {
      id: checklistId,
      title: title,
      description: description,
      questions: questions,
      createdAt: new Date().toISOString()
    };
    
    // Salvar no localStorage (simulação)
    localStorage.setItem(`custom-checklist-${checklistId}`, JSON.stringify(checklistData));
    
    // Redirecionar para a página inicial
    window.location.href = '/';
  });
  
  // Inicializar
  updateQuestionsCount();
});