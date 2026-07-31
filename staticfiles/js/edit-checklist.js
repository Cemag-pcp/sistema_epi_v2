import { getCookie, ToastBottomEnd, toggleSpinner } from "../../../static/js/scripts.js";

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loadingSpinner = document.getElementById('loadingSpinner');
    const contentArea = document.getElementById('contentArea');
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    const setorSelect = document.getElementById('setor');
    const questionTextInput = document.getElementById('question-text');
    const addQuestionBtn = document.getElementById('addQuestionBtn');
    const questionsContainer = document.getElementById('questionsContainer');
    const emptyState = document.getElementById('emptyState');
    const questionsCount = document.getElementById('questionsCount');
    const totalQuestions = document.getElementById('totalQuestions');
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    
    // Modal elements
    const editQuestionModal = new bootstrap.Modal(document.getElementById('editQuestionModal'));
    const editQuestionText = document.getElementById('edit-question-text');
    const editQuestionId = document.getElementById('edit-question-id');
    const saveQuestionBtn = document.getElementById('saveQuestionBtn');
    
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteQuestionConfirmModal'));
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    // State
    let questions = [];
    let currentEditingId = null;
    let currentDeletingId = null;
    let checklistId = null;
    let setores = [];
    
    // Função para mostrar o spinner e ocultar o conteúdo
    function showSpinner() {
        loadingSpinner.style.display = 'block';
        contentArea.style.display = 'none';
    }
    
    // Função para esconder o spinner e mostrar o conteúdo
    function hideSpinner() {
        loadingSpinner.style.display = 'none';
        contentArea.style.display = 'block';
    }
    
    // Initialize the page
    async function init() {
        showSpinner(); // Mostrar spinner antes de carregar
        
        // Get checklist ID from URL
        const pathParts = window.location.pathname.split('/');
        checklistId = pathParts[pathParts.length - 2];
        
        try {
            // Load setores
            await loadSetores();
            
            // Load checklist data if editing
            if (checklistId) {
                await loadChecklistData();
            } else {
                // New checklist
                updateQuestionsCount();
                hideSpinner(); // Esconder spinner para novo checklist
            }
        } catch (error) {
            showError('Erro ao carregar dados: ' + error.message);
            hideSpinner(); // Esconder spinner mesmo em caso de erro
        }
    }
    
    // Load setores from API
    async function loadSetores() {
        try {
            const response = await fetch('/api_setores/');
            if (!response.ok) {
                throw new Error('Erro ao carregar setores');
            }
            setores = await response.json();
            
            // Populate setor select
            setorSelect.innerHTML = '<option value="">Selecionar setor</option>';
            setores.forEach(setor => {
                const option = document.createElement('option');
                option.value = setor.id;
                option.textContent = setor.nome;
                setorSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Erro ao carregar setores:', error);
        }
    }
    
    // Load checklist data
    async function loadChecklistData() {
        try {
            const response = await fetch(`/api/checklists/inspection/${checklistId}/`);
            if (!response.ok) {
                throw new Error('Checklist não encontrado');
            }
            
            const result = await response.json();
            const checklist = result.data;
            
            // Populate form
            titleInput.value = checklist.nome;
            descriptionInput.value = checklist.descricao;
            setorSelect.value = checklist.setor ? checklist.setor.id : '';
            
            // Load questions from the inspection API response
            questions = checklist.perguntas;
            renderQuestions();
            updateQuestionsCount();
            
        } catch (error) {
            showError('Erro ao carregar checklist: ' + error.message);
        } finally {
            hideSpinner(); // Esconder spinner após carregamento (ou erro)
        }
    }
    
    // Render questions list
    function renderQuestions() {
        if (questions.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        }
        
        emptyState.classList.add('d-none');
        questionsContainer.innerHTML = '';
        
        questions.forEach((question, index) => {
            const questionElement = document.createElement('div');
            questionElement.className = 'card question-card mb-3';
            questionElement.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <span class="badge bg-dark me-2">#${index + 1}</span>
                            <h3 class="h6 fw-medium mb-1">${question.texto}</h3>
                        </div>
                        <div class="question-actions">
                            <button class="btn btn-sm btn-outline-primary me-1 edit-btn" data-id="${question.id}">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${question.id}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            questionsContainer.appendChild(questionElement);
        });
        
        // Add event listeners to edit and delete buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                editQuestion(id);
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                showDeleteConfirm(id);
            });
        });
    }
    
    // Update questions count
    function updateQuestionsCount() {
        questionsCount.textContent = questions.length;
        totalQuestions.textContent = questions.length;
    }
    
    // Add a new question
    async function addQuestion() {
        const texto = questionTextInput.value.trim();
        
        if (!texto) {
            showError('O texto da pergunta é obrigatório');
            return;
        }
        
        try {
            // For new checklist, just add to local array
            const newQuestion = {
                id: Date.now().toString(), // ID temporário
                texto: texto
            };
            
            questions.push(newQuestion);
            
            renderQuestions();
            updateQuestionsCount();
            
            // Clear input
            questionTextInput.value = '';
            
        } catch (error) {
            showError('Erro ao adicionar pergunta: ' + error.message);
        }
    }
    
    // Edit question
    function editQuestion(id) {
        const question = questions.find(q => q.id == id);
        if (!question) return;
        
        editQuestionText.value = question.texto;
        editQuestionId.value = question.id;
        
        currentEditingId = id;
        editQuestionModal.show();
    }
    
    // Save edited question
    async function saveEditedQuestion() {
        const texto = editQuestionText.value.trim();
        
        if (!texto) {
            showError('O texto da pergunta é obrigatório');
            return;
        }
        
        try {
            const questionId = editQuestionId.value;
            
            // Update local array
            const index = questions.findIndex(q => q.id == questionId);
            if (index !== -1) {
                questions[index].texto = texto;
            }
            
            showSuccess('Pergunta atualizada');
            renderQuestions();
            editQuestionModal.hide();
            
        } catch (error) {
            showError('Erro ao atualizar pergunta: ' + error.message);
        }
    }
    
    // Show delete confirmation
    function showDeleteConfirm(id) {
        currentDeletingId = id;
        deleteConfirmModal.show();
    }
    
    // Confirm delete
    async function confirmDelete() {
        if (!currentDeletingId) return;
        
        try {
            // Update local array
            questions = questions.filter(q => q.id != currentDeletingId);
            showSuccess('Pergunta excluída');
            
            renderQuestions();
            updateQuestionsCount();
            deleteConfirmModal.hide();
            currentDeletingId = null;
            
        } catch (error) {
            showError('Erro ao excluir pergunta: ' + error.message);
        }
    }
    
    // Validate form
    function validateForm() {
        const errors = [];
        
        if (!titleInput.value.trim()) {
            errors.push('O título do template é obrigatório');
        }
        
        if (questions.length === 0) {
            errors.push('Pelo menos uma pergunta é necessária');
        }
        
        // Validar se todas as perguntas têm texto
        const perguntasSemTexto = questions.filter(q => !q.texto || !q.texto.trim());
        if (perguntasSemTexto.length > 0) {
            errors.push('Todas as perguntas devem ter texto');
        }
        
        return errors;
    }
    
    // Save template
    async function saveTemplate() {

        toggleSpinner('saveTemplateBtn', true);

        const errors = validateForm();
        
        if (errors.length > 0) {
            showErrors(errors);
            return;
        }
        
        try {
            const checklistData = {
                nome: titleInput.value.trim(),
                descricao: descriptionInput.value.trim(),
                setor: setorSelect.value || null,
                ativo: true,
                perguntas: questions.map(q => ({ 
                    id: q.id, 
                    texto: q.texto 
                }))
            };
            
            let response;
            let url;
            let method;
            
            if (checklistId) {
                // Update existing checklist using the specific edit endpoint
                url = `/api/checklists/edit/${checklistId}/`;
                method = 'PUT';
            }
            
            response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(checklistData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao salvar checklist');
            }
            
            const savedChecklist = await response.json();
            showSuccess('Checklist salvo com sucesso!');
            
            // Redirecionar imediatamente para /checklists/ sem setTimeout
            window.location.href = "/checklists/";
            
        } catch (error) {
            showError('Erro ao salvar checklist: ' + error.message);
        } finally {
            toggleSpinner('saveTemplateBtn', false);
        }
    }

    
    // Show single error
    function showError(message) {
        ToastBottomEnd.fire({
            icon: 'error',
            title: message,
        });
    }
    
    // Show success message
    function showSuccess(message) {
        ToastBottomEnd.fire({
            icon: 'success',
            title: message,
        });
    }

    // Event listeners
    addQuestionBtn.addEventListener('click', addQuestion);
    saveTemplateBtn.addEventListener('click', saveTemplate);
    saveQuestionBtn.addEventListener('click', saveEditedQuestion);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    // Initialize the page
    init();
});