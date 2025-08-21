import { getCookie, toggleSpinner, ToastBottomEnd } from "../../../static/js/scripts.js";

document.addEventListener('DOMContentLoaded', function() {
    // Obter o ID do checklist da URL
    const pathParts = window.location.pathname.split('/');
    const checklistId = pathParts[pathParts.length - 2];
    
    // Elementos da interface
    const questionsContainer = document.getElementById('questions-container');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
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
                        
                        <!-- Notas -->
                        <div class="mb-3">
                            <label for="notes-${pergunta.id}" class="form-label">Observações</label>
                            <textarea class="form-control notes-input" id="notes-${pergunta.id}" data-question="${pergunta.id}" rows="3" placeholder="Adicione observações sobre esta questão..."></textarea>
                        </div>
                    </div>
                </div>
            `;
            
            questionsContainer.innerHTML += questionHtml;
            questions.push(pergunta);
            
            // Inicializar resposta vazia para esta pergunta
            responses[pergunta.id] = {
                conformidade: null,
                observacao: ''
            };
        });
        
        // Mostrar rodapé
        footerCard.classList.remove('d-none');
        updateProgress();
        
        // Adicionar event listeners aos botões
        document.querySelectorAll('.compliance-btn').forEach(btn => {
            btn.addEventListener('click', handleComplianceClick);
        });
        
        document.querySelectorAll('.notes-input').forEach(input => {
            input.addEventListener('input', handleNotesInput);
        });
    }
    
    // Manipulador de clique nos botões de conformidade
    function handleComplianceClick(e) {
        const questionId = e.target.dataset.question;
        const isCompliant = e.target.dataset.compliant === 'true';
        
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
            // Rolar para a primeira questão não respondida
            const firstUnansweredId = unanswered[0][0];
            document.getElementById(`question-${firstUnansweredId}`).scrollIntoView({ behavior: 'smooth' });
            toggleSpinner('submit-btn', false);
            return;
        }
        
        try {
            // Preparar dados para envio
            const inspectionData = {
                checklist: checklistId,
                respostas: Object.entries(responses).map(([perguntaId, resposta]) => ({
                    pergunta: parseInt(perguntaId),
                    conformidade: resposta.conformidade,
                    observacao: resposta.observacao,
                    texto_pergunta_historico: questions.find(q => q.id == perguntaId).texto
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
        errorMessage.textContent = message;
        errorAlert.classList.remove('d-none');
        
        // Esconder o alerta após 5 segundos
        setTimeout(() => {
            errorAlert.classList.add('d-none');
        }, 5000);
    }
    
    // Event listener para o botão de envio
    submitBtn.addEventListener('click', submitInspection);
    
    // Inicializar a página
    fetchChecklist();
});