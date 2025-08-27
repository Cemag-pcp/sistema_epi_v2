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
    
    // Estado da aplicação
    let checklistData = null;
    let questions = [];
    let responses = {};
    
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
                        <!-- Botões de conformidade -->
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
                        
                        <!-- Notas -->
                        <div class="mb-3">
                            <label for="notes-${pergunta.id}" class="form-label">Observações</label>
                            <textarea class="form-control notes-input" id="notes-${pergunta.id}" data-question="${pergunta.id}" rows="3" placeholder="Adicione observações sobre esta questão..."></textarea>
                        </div>
                        
                        <!-- Upload de Fotos -->
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
        // Botões de conformidade
        document.querySelectorAll('.compliance-btn').forEach(btn => {
            btn.addEventListener('click', handleComplianceClick);
        });
        
        // Campos de observações
        document.querySelectorAll('.notes-input').forEach(input => {
            input.addEventListener('input', handleNotesInput);
        });
        
        // Campos de causa e ação
        document.querySelectorAll('input[id^="causes-"], input[id^="actions-"]').forEach(input => {
            input.addEventListener('input', handleCauseActionInput);
        });
        
        // Botões de adicionar foto
        document.querySelectorAll('.add-photo-btn').forEach(btn => {
            btn.addEventListener('click', handleAddPhotoClick);
        });
        
        // Inputs de foto
        document.querySelectorAll('.photo-input').forEach(input => {
            input.addEventListener('change', handlePhotoInputChange);
        });
    }
    
    // Manipulador de clique nos botões de conformidade
    function handleComplianceClick(e) {
        const questionId = e.currentTarget.dataset.question;
        const isCompliant = e.currentTarget.dataset.compliant === 'true';
        
        // Atualizar estado do botão
        document.querySelectorAll(`.compliance-btn[data-question="${questionId}"]`).forEach(btn => {
            if (btn.dataset.compliant === 'true') {
                btn.classList.toggle('btn-success', isCompliant);
                btn.classList.toggle('btn-outline-success', !isCompliant);
            } else {
                btn.classList.toggle('btn-danger', !isCompliant);
                btn.classList.toggle('btn-outline-danger', isCompliant);
            }
        });
        
        // Atualizar resposta
        responses[questionId].conformidade = isCompliant;
        updateProgress();
    }
    
    // Manipulador de entrada de observações
    function handleNotesInput(e) {
        const questionId = e.target.dataset.question;
        responses[questionId].observacao = e.target.value;
    }
    
    // Manipulador de entrada para causa e ação
    function handleCauseActionInput(e) {
        const questionId = e.target.dataset.question;
        const fieldType = e.target.id.startsWith('causes-') ? 'causa' : 'acao';
        responses[questionId][fieldType] = e.target.value;
    }
    
    // Manipulador de clique no botão de adicionar foto
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
            
            // Verificar se é uma imagem
            if (!file.type.startsWith('image/')) {
                showError('Por favor, selecione apenas arquivos de imagem.');
                continue;
            }
            
            // Verificar tamanho do arquivo (máximo 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showError('A imagem deve ter no máximo 5MB.');
                continue;
            }
            
            // Criar preview da imagem
            const reader = new FileReader();
            reader.onload = function(e) {
                const photoId = Date.now() + Math.random().toString(36).substr(2, 9);
                
                const photoHtml = `
                    <div class="photo-preview-item position-relative" data-photo-id="${photoId}">
                        <img src="${e.target.result}" class="img-thumbnail" style="width: 100px; height: 100px; object-fit: cover;">
                        <button type="button" class="btn btn-danger btn-sm position-absolute top-0 end-0 m-1 remove-photo-btn" data-question-id="${questionId}" data-photo-id="${photoId}">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                `;
                
                // Usar insertAdjacentHTML para não perder event listeners existentes
                previewContainer.insertAdjacentHTML('beforeend', photoHtml);
                
                // Adicionar foto ao estado
                responses[questionId].fotos.push({
                    id: photoId,
                    file: file,
                    preview: e.target.result
                });
                
                // Adicionar event listener para o botão de remover
                const removeBtn = previewContainer.querySelector(`.remove-photo-btn[data-photo-id="${photoId}"]`);
                removeBtn.addEventListener('click', handleRemovePhotoClick);
            };
            
            reader.readAsDataURL(file);
        }
        
        // Limpar input para permitir selecionar o mesmo arquivo novamente
        e.target.value = '';
    }
    
    // Manipulador de clique no botão de remover foto
    function handleRemovePhotoClick(e) {
        const button = e.currentTarget;
        const questionId = button.dataset.questionId;
        const photoId = button.dataset.photoId;
        
        if (!questionId || !photoId) {
            console.error('Dados do botão de remover foto não encontrados:', button.dataset);
            return;
        }
        
        // Remover do DOM
        const photoElement = document.querySelector(`.photo-preview-item[data-photo-id="${photoId}"]`);
        if (photoElement) {
            photoElement.remove();
        }
        
        // Remover do estado
        if (responses[questionId] && responses[questionId].fotos) {
            responses[questionId].fotos = responses[questionId].fotos.filter(photo => photo.id !== photoId);
        }
    }
    
    // Função para converter arquivo para base64
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
        });
    }
    
    // Atualizar barra de progresso
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
    
    // Função para enviar a inspeção
    async function submitInspection() {
        // Validar se todas as questões foram respondidas
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
            // Preparar dados para envio
            const inspectionData = {
                checklist: checklistId,
                respostas: await Promise.all(Object.entries(responses).map(async ([perguntaId, resposta]) => {
                    // Converter fotos para base64
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
            
            // Enviar para a API
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
            
            // Mostrar modal de sucesso
            completionModal.show();
            
        } catch (error) {
            showError(error.message || 'Erro ao enviar a inspeção');
        } finally {
            toggleSpinner('submit-btn', false);
        }
    }
    
    // Função para mostrar erro
    function showError(message) {
        ToastBottomEnd.fire({
            icon: 'error',
            title: message,
        });
    }
    
    // Event listener para o botão de envio
    submitBtn.addEventListener('click', submitInspection);
    
    // Inicializar a página
    fetchChecklist();
});