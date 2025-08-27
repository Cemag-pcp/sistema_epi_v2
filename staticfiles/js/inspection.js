import { getCookie, toggleSpinner, ToastBottomEnd } from "../../../static/js/scripts.js";

document.addEventListener('DOMContentLoaded', function() {
    // Obter o ID do checklist da URL
    const pathParts = window.location.pathname.split('/');
    const checklistId = pathParts[pathParts.length - 2];
    
    // Elementos da interface
    const questionsContainer = document.getElementById('questions-container');
    const footerCard = document.getElementById('footer-card');
    const submitBtn = document.getElementById('submit-btn');
    const completionModal = new bootstrap.Modal(document.getElementById('completion-modal'));
    
    // >>> INÍCIO DA ADIÇÃO: Variáveis para os modais <<<
    let deletePhotoModal, confirmDeleteBtn;
    let imageViewerModal, modalImageContent;
    // >>> FIM DA ADIÇÃO <<<

    // Estado da aplicação
    let checklistData = null;
    let questions = [];
    let responses = {};

    // >>> INÍCIO DA ADIÇÃO: Inicialização dos modais <<<
    // Modal de confirmação de exclusão
    const deleteModalEl = document.getElementById('deletePhotoConfirmModal');
    if (deleteModalEl) {
        deletePhotoModal = new bootstrap.Modal(deleteModalEl);
        confirmDeleteBtn = document.getElementById('confirmPhotoDeleteBtn');

        confirmDeleteBtn.addEventListener('click', function() {
            const questionId = this.dataset.questionId;
            const photoId = this.dataset.photoId;
            if (questionId && photoId) {
                // Chama a função de remoção com os dados armazenados
                handleRemovePhotoClick(questionId, photoId);
                deletePhotoModal.hide();
            }
        });
    }

    // Modal de visualização de imagem
    const imageViewerModalEl = document.getElementById('imageViewerModal');
    if (imageViewerModalEl) {
        imageViewerModal = new bootstrap.Modal(imageViewerModalEl);
        modalImageContent = document.getElementById('modal-image-content');
    }
    // >>> FIM DA ADIÇÃO <<<
    
    // Função para buscar dados do checklist
    async function fetchChecklist() {
        try {
            const response = await fetch(`/api/checklists/inspection/${checklistId}/`);
            if (!response.ok) {
                throw new Error('Checklist não encontrado');
            }
            checklistData = await response.json();
            displayChecklist();
        } catch (error) {
            showError(error.message || 'Erro ao carregar o checklist');
        }
    }
    
    // Função para exibir o checklist
    function displayChecklist() {
        if (!checklistData.data) return;
        
        // Atualizar título
        document.getElementById('checklist-title').textContent = checklistData.data.nome;
        document.getElementById('checklist-description').textContent = checklistData.data.descricao;
        document.getElementById('checklist-complete-title').textContent = checklistData.data.nome;
        document.getElementById('questions-info').textContent = `${checklistData.data.perguntas.length} questões`;
        
        // Renderizar questões
        questionsContainer.innerHTML = '';
        
        checklistData.data.perguntas.forEach((pergunta, index) => {
            const questionHtml = `
                <div class="card mb-4 question-card" id="question-${pergunta.id}">
                    <div class="card-header bg-white">
                        <div class="d-flex gap-2 mb-2">
                            <span class="badge bg-dark">#${index + 1}</span>
                            <span class="badge bg-danger d-none required-badge">Obrigatório</span>
                        </div>
                        <h5 class="card-title">${pergunta.texto}</h5>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">Status de Conformidade</label>
                            <div class="d-flex gap-2">
                                <button type="button" class="btn btn-outline-success flex-grow-1 compliance-btn" data-question="${pergunta.id}" data-compliant="true">
                                    <i class="bi bi-check-circle me-2"></i>Conforme
                                </button>
                                <button type="button" class="btn btn-outline-danger flex-grow-1 compliance-btn" data-question="${pergunta.id}" data-compliant="false">
                                    <i class="bi bi-x-circle me-2"></i>Não Conforme
                                </button>
                            </div>
                        </div>

                        <div class="mb-3">
                            <div class="row">
                                <div class="col-sm-6">
                                    <label for="causes-${pergunta.id}" class="form-label">Causa(s) de reprovação</label>
                                    <input class="form-control" id="causes-${pergunta.id}" data-question="${pergunta.id}">
                                </div>
                                <div class="col-sm-6">
                                    <label for="actions-${pergunta.id}" class="form-label">Ação(ões) corretiva(s)</label>
                                    <input class="form-control" id="actions-${pergunta.id}" data-question="${pergunta.id}">
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label for="notes-${pergunta.id}" class="form-label">Observações</label>
                            <textarea class="form-control notes-input" id="notes-${pergunta.id}" data-question="${pergunta.id}" rows="3" placeholder="Adicione observações sobre esta questão..."></textarea>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Fotos</label>
                            <div class="photo-upload-container" data-question="${pergunta.id}">
                                <input type="file" class="d-none photo-input" id="photo-input-${pergunta.id}" accept="image/*" multiple>
                                <button type="button" class="btn btn-outline-primary btn-sm add-photo-btn" data-question="${pergunta.id}">
                                    <i class="bi bi-camera me-1"></i>Adicionar Fotos
                                </button>
                                <div class="photo-preview-container mt-2 d-flex flex-wrap gap-2" id="photo-preview-${pergunta.id}"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            questionsContainer.innerHTML += questionHtml;
            questions.push(pergunta);
            
            // Inicializar resposta vazia para esta pergunta
            responses[pergunta.id] = {
                conformidade: null,
                observacao: '',
                causa: '',
                acao: '',
                fotos: []
            };
        });
        
        // Mostrar rodapé
        footerCard.classList.remove('d-none');
        updateProgress();
        
        // Adicionar event listeners
        addEventListeners();
    }
    
    // Adicionar todos os event listeners
    function addEventListeners() {
        // ... (outros listeners não precisam ser alterados)
        document.querySelectorAll('.compliance-btn').forEach(btn => btn.addEventListener('click', handleComplianceClick));
        document.querySelectorAll('.notes-input').forEach(input => input.addEventListener('input', handleNotesInput));
        document.querySelectorAll('input[id^="causes-"], input[id^="actions-"]').forEach(input => input.addEventListener('input', handleCauseActionInput));
        document.querySelectorAll('.add-photo-btn').forEach(btn => btn.addEventListener('click', handleAddPhotoClick));
        document.querySelectorAll('.photo-input').forEach(input => input.addEventListener('change', handlePhotoInputChange));
    }
    
    // ... (funções handleComplianceClick, handleNotesInput, handleCauseActionInput, handleAddPhotoClick não mudam)
    function handleComplianceClick(e) {
        const questionId = e.currentTarget.dataset.question;
        const isCompliant = e.currentTarget.dataset.compliant === 'true';
        document.querySelectorAll(`.compliance-btn[data-question="${questionId}"]`).forEach(btn => {
            if (btn.dataset.compliant === 'true') {
                btn.classList.toggle('btn-success', isCompliant);
                btn.classList.toggle('btn-outline-success', !isCompliant);
            } else {
                btn.classList.toggle('btn-danger', !isCompliant);
                btn.classList.toggle('btn-outline-danger', isCompliant);
            }
        });
        responses[questionId].conformidade = isCompliant;
        updateProgress();
    }
    function handleNotesInput(e) {
        responses[e.target.dataset.question].observacao = e.target.value;
    }
    function handleCauseActionInput(e) {
        const questionId = e.target.dataset.question;
        const fieldType = e.target.id.startsWith('causes-') ? 'causa' : 'acao';
        responses[questionId][fieldType] = e.target.value;
    }
    function handleAddPhotoClick(e) {
        const questionId = e.currentTarget.dataset.question;
        document.getElementById(`photo-input-${questionId}`).click();
    }
    
    // Manipulador de seleção de arquivo de foto
    function handlePhotoInputChange(e) {
        const questionId = e.target.dataset.question || e.target.id.split('-')[2];
        const files = e.target.files;
        if (!files.length) return;
        
        const previewContainer = document.getElementById(`photo-preview-${questionId}`);
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) {
                showError('Por favor, selecione apenas arquivos de imagem.');
                continue;
            }
            if (file.size > 5 * 1024 * 1024) {
                showError('A imagem deve ter no máximo 5MB.');
                continue;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                const photoId = Date.now() + Math.random().toString(36).substr(2, 9);
                
                // >>> ALTERAÇÃO: Adicionado cursor:pointer na imagem <<<
                const photoHtml = `
                    <div class="photo-preview-item position-relative" data-photo-id="${photoId}">
                        <img src="${e.target.result}" class="img-thumbnail" style="width: 100px; height: 100px; object-fit: cover; cursor: pointer;">
                        <button type="button" class="btn btn-danger btn-sm position-absolute top-0 end-0 m-1 remove-photo-btn" data-question-id="${questionId}" data-photo-id="${photoId}">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                `;
                
                previewContainer.insertAdjacentHTML('beforeend', photoHtml);
                
                responses[questionId].fotos.push({
                    id: photoId,
                    file: file,
                    preview: e.target.result
                });
                
                // >>> INÍCIO DA ALTERAÇÃO: Adicionar listeners para modais <<<
                const newPhotoItem = previewContainer.querySelector(`.photo-preview-item[data-photo-id="${photoId}"]`);
                const removeBtn = newPhotoItem.querySelector('.remove-photo-btn');
                const imgElement = newPhotoItem.querySelector('.img-thumbnail');

                // Listener para o botão de remover (abre o modal de confirmação)
                removeBtn.addEventListener('click', function() {
                    if (confirmDeleteBtn && deletePhotoModal) {
                        confirmDeleteBtn.dataset.questionId = questionId;
                        confirmDeleteBtn.dataset.photoId = photoId;
                        deletePhotoModal.show();
                    }
                });

                // Listener para a imagem (abre o modal de visualização)
                imgElement.addEventListener('click', function() {
                    if (modalImageContent && imageViewerModal) {
                        modalImageContent.src = this.src;
                        imageViewerModal.show();
                    }
                });
                // >>> FIM DA ALTERAÇÃO <<<
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    }
    
    // >>> ALTERAÇÃO: A função agora recebe os IDs como parâmetros <<<
    function handleRemovePhotoClick(questionId, photoId) {
        if (!questionId || !photoId) {
            console.error('IDs da foto ou da questão não fornecidos para remoção.');
            return;
        }
        
        // Remover do DOM
        const photoElement = document.querySelector(`.photo-preview-item[data-photo-id="${photoId}"]`);
        if (photoElement) {
            photoElement.remove();
        }
        
        // Remover do estado
        if (responses[questionId] && responses[questionId].fotos) {
            responses[questionId].fotos = responses[questionId].fotos.filter(photo => photo.id.toString() !== photoId.toString());
        }
    }
    
    // ... (O restante das funções como fileToBase64, updateProgress, submitInspection, showError permanecem iguais)
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
        });
    }

    function updateProgress() {
        const answered = Object.values(responses).filter(r => r.conformidade !== null).length;
        const compliant = Object.values(responses).filter(r => r.conformidade === true).length;
        const nonCompliant = Object.values(responses).filter(r => r.conformidade === false).length;
        
        document.getElementById('progress-text').textContent = `${answered} de ${questions.length} questões respondidas`;
        document.getElementById('compliant-count').textContent = compliant;
        document.getElementById('non-compliant-count').textContent = nonCompliant;
        
        document.getElementById('total-answered').textContent = answered;
        document.getElementById('compliant-count-modal').textContent = compliant;
        document.getElementById('non-compliant-count-modal').textContent = nonCompliant;
    }

    async function submitInspection() {
        const unanswered = Object.entries(responses).filter(([id, r]) => r.conformidade === null);
        toggleSpinner('submit-btn', true);

        if (unanswered.length > 0) {
            showError('Por favor, responda todas as questões antes de enviar.');
            const firstUnansweredId = unanswered[0][0];
            document.getElementById(`question-${firstUnansweredId}`).scrollIntoView({ behavior: 'smooth' });
            toggleSpinner('submit-btn', false);
            return;
        }
        
        try {
            const inspectionData = {
                checklist: checklistId,
                respostas: await Promise.all(Object.entries(responses).map(async ([perguntaId, resposta]) => {
                    const fotosBase64 = await Promise.all(
                        resposta.fotos.map(async (foto) => ({
                            nome: foto.file.name,
                            tipo: foto.file.type,
                            dados: await fileToBase64(foto.file)
                        }))
                    );
                    
                    return {
                        pergunta: parseInt(perguntaId),
                        conformidade: resposta.conformidade,
                        observacao: resposta.observacao,
                        causa: resposta.causa,
                        acao: resposta.acao,
                        texto_pergunta_historico: questions.find(q => q.id == perguntaId).texto,
                        fotos: fotosBase64
                    };
                }))
            };
            
            const response = await fetch('/api/checklists/inspection/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(inspectionData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Erro ao enviar a inspeção');
            }
            
            completionModal.show();
            
        } catch (error) {
            showError(error.message || 'Erro ao enviar a inspeção');
        } finally {
            toggleSpinner('submit-btn', false);
        }
    }

    function showError(message) {
        ToastBottomEnd.fire({
            icon: 'error',
            title: message,
        });
    }
    
    submitBtn.addEventListener('click', submitInspection);
    fetchChecklist();
});