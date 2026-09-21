import { getCookie, ToastBottomEnd, toggleSpinner } from "../../../static/js/scripts.js";
import { parseQuestionList, isMultilineText } from "./question-list.js";

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loadingSpinner = document.getElementById('loadingSpinner');
    const contentArea = document.getElementById('contentArea');
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    const setorSelect = document.getElementById('setor');
    const maquinaSelect = document.getElementById('maquina');
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
    let maquinaAtual = null;
    
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
                // Sem await: a lista vem de outro sistema e não deve atrasar a tela
                loadMaquinas();
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
            maquinaAtual = checklist.maquina || null;
            preencherMaquinas([], maquinaAtual ? String(maquinaAtual.id) : '');
            
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
    
    // Select da máquina (select2). Começa só com a máquina atual e recebe a lista completa
    // quando a API de manutenção responder, mantendo o que o usuário já tiver escolhido.
    function preencherMaquinas(maquinas, selecionada) {
        const jaInicializado = maquinaSelect.dataset.select2Pronto === 'true';
        maquinaSelect.innerHTML = '<option value=""></option>';

        const lista = [...maquinas];
        if (maquinaAtual && !lista.some(m => m.id === maquinaAtual.id)) {
            lista.unshift({ id: maquinaAtual.id, nome: maquinaAtual.nome, setor: '' });
        }
        lista.forEach(maquina => {
            const option = document.createElement('option');
            option.value = maquina.id;
            option.textContent = maquina.setor ? `${maquina.nome} (${maquina.setor})` : maquina.nome;
            maquinaSelect.appendChild(option);
        });
        maquinaSelect.value = selecionada;

        if (window.jQuery && jQuery.fn.select2) {
            if (!jaInicializado) {
                jQuery(maquinaSelect).select2({
                    theme: 'bootstrap-5',
                    width: '100%',
                    allowClear: true,
                    placeholder: 'Sem máquina',
                    language: { noResults: () => 'Nenhuma máquina encontrada' },
                });
                maquinaSelect.dataset.select2Pronto = 'true';
            }
            jQuery(maquinaSelect).trigger('change.select2');
        }
    }

    async function loadMaquinas() {
        try {
            const response = await fetch('/api/checklists/maquinas/');
            if (!response.ok) {
                throw new Error('Erro ao carregar máquinas');
            }
            const { maquinas } = await response.json();
            preencherMaquinas(maquinas, maquinaSelect.value);
        } catch (error) {
            console.error('Erro ao carregar máquinas:', error);
            showError('Não foi possível carregar a lista de máquinas.');
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
    
    // Colar uma lista (ex.: copiada de um PDF) gera várias perguntas de uma vez.
    // O <input> descartaria as quebras de linha, por isso o texto é lido direto da colagem.
    function handleQuestionPaste(e) {
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        if (!isMultilineText(pasted)) return; // uma linha só: colagem normal

        e.preventDefault();
        const texts = parseQuestionList(pasted);
        if (texts.length === 0) return;
        if (texts.length === 1) {
            questionTextInput.value = texts[0];
            return;
        }

        // O id temporário precisa continuar numérico: o servidor o procura como id de pergunta
        // e, não achando, cria uma nova.
        const baseId = Date.now() * 1000;
        texts.forEach((texto, index) => {
            questions.push({ id: (baseId + index).toString(), texto: texto });
        });
        renderQuestions();
        updateQuestionsCount();
        questionTextInput.value = '';
        showSuccess(`${texts.length} perguntas adicionadas`);
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
                maquina_id: maquinaSelect.value || null,
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
    questionTextInput.addEventListener('paste', handleQuestionPaste);
    saveTemplateBtn.addEventListener('click', saveTemplate);
    saveQuestionBtn.addEventListener('click', saveEditedQuestion);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    // Initialize the page
    init();
});