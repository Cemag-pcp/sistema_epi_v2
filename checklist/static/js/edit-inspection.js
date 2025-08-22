import { getCookie, toggleSpinner, ToastBottomEnd } from "../../../static/js/scripts.js";

// Obter o ID da inspeção da URL
const pathParts = window.location.pathname.split('/');
const inspectionId = pathParts[pathParts.length - 2];

// Carregar os dados da inspeção
async function loadInspectionData() {
    try {
        const response = await fetch(`/api/checklists/inspection/data/${inspectionId}/`);
        if (!response.ok) throw new Error('Erro ao carregar dados da inspeção');
        
        return await response.json();
    } catch (error) {
        console.error('Erro:', error);
        showError('Falha ao carregar dados da inspeção');
        return null;
    }
}

// Função para preencher o formulário com os dados existentes
function populateFormWithData(inspectionData) {
    // Atualizar informações do cabeçalho
    document.getElementById('checklist-title').textContent = `Editando: ${inspectionData.checklist.nome}`;
    document.getElementById('questions-info').textContent = `${inspectionData.respostas.length} questões`;
    document.getElementById('inspection-info').textContent = 
        `Data: ${new Date(inspectionData.data_inspecao).toLocaleDateString('pt-BR')} | Inspetor: ${inspectionData.inspetor.nome}`;
    
    // Preencher as questões com as respostas existentes
    const questionsContainer = document.getElementById('questions-container');
    
    let html = '';
    inspectionData.respostas.forEach((resposta, index) => {
        const conformeClass = resposta.conformidade ? 'btn-success' : 'btn-outline-success';
        const naoConformeClass = !resposta.conformidade ? 'btn-danger' : 'btn-outline-danger';
        
        html += `
        <div class="card mb-3 question-card" data-question-id="${resposta.pergunta_id}" data-index="${index}">
            <div class="card-body p-4">
                <h5 class="fw-medium mb-3">${index + 1}. ${resposta.texto_pergunta}</h5>
                
                <div class="mb-3">
                    <label class="form-label">Conformidade:</label>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn ${conformeClass} flex-grow-1 conformity-btn" data-value="true" data-index="${index}">
                            <i class="bi bi-check-circle me-1"></i>Conforme
                        </button>
                        <button type="button" class="btn ${naoConformeClass} flex-grow-1 conformity-btn" data-value="false" data-index="${index}">
                            <i class="bi bi-x-circle me-1"></i>Não Conforme
                        </button>
                    </div>
                    <input type="hidden" id="conformidade-${index}" value="${resposta.conformidade}">
                </div>

                <div class="mb-3">
                    <div class="row">
                        <div class="col-sm-6">
                            <label for="causes-${index}" class="form-label">Causa(s) de reprovação</label>
                            <input class="form-control" id="causes-${index}" data-question="${index}" value="${resposta.causas_reprovacao}">
                        </div>
                        <div class="col-sm-6">
                            <label for="actions-${index}" class="form-label">Ação(ões) corretiva(s)</label>
                            <input class="form-control" id="actions-${index}" data-question="${index}" value="${resposta.acoes_corretivas}">
                        </div>
                    </div>
                </div>
                
                <div class="mb-0">
                    <label for="observacao-${index}" class="form-label">Observações:</label>
                    <textarea class="form-control" id="observacao-${index}" rows="2" 
                        placeholder="Adicione observações relevantes...">${resposta.observacao || ''}</textarea>
                </div>
            </div>
        </div>
        `;
    });
    
    questionsContainer.innerHTML = html;
    document.getElementById('footer-card').classList.remove('d-none');
    setupConformityButtons();
    updateProgress();
}

// Configurar os botões de conformidade
function setupConformityButtons() {
    document.querySelectorAll('.conformity-btn').forEach(button => {
        button.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            const value = this.getAttribute('data-value') === 'true';
            const card = document.querySelector(`.question-card[data-index="${index}"]`);
            
            // Atualizar o valor oculto
            document.getElementById(`conformidade-${index}`).value = value;
            
            // Atualizar a aparência dos botões
            const conformeBtn = card.querySelector('.conformity-btn[data-value="true"]');
            const naoConformeBtn = card.querySelector('.conformity-btn[data-value="false"]');
            
            if (value) {
                conformeBtn.classList.remove('btn-outline-success');
                conformeBtn.classList.add('btn-success');
                naoConformeBtn.classList.remove('btn-danger');
                naoConformeBtn.classList.add('btn-outline-danger');
            } else {
                conformeBtn.classList.remove('btn-success');
                conformeBtn.classList.add('btn-outline-success');
                naoConformeBtn.classList.remove('btn-outline-danger');
                naoConformeBtn.classList.add('btn-danger');
            }
            
            // Atualizar o progresso
            updateProgress();
        });
    });
}

// Função para coletar os dados atualizados
function getUpdatedData() {
    const questionCards = document.querySelectorAll('.question-card');
    const updatedResponses = [];
    
    questionCards.forEach((card) => {
        const index = card.getAttribute('data-index');
        const questionId = card.getAttribute('data-question-id');
        const conformity = document.getElementById(`conformidade-${index}`).value === 'true';
        const causes = document.getElementById(`causes-${index}`).value;
        const actions = document.getElementById(`actions-${index}`).value;
        const observation = document.getElementById(`observacao-${index}`).value;
        
        updatedResponses.push({
            pergunta_id: questionId,
            conformidade: conformity,
            causa: causes,
            acao: actions,
            observacao: observation
        });
    });
    
    return {
        inspection_id: inspectionId,
        respostas: updatedResponses
    };
}

// Função para enviar as atualizações
async function submitUpdates() {
    const updatedData = getUpdatedData();

    toggleSpinner('update-btn', true);
    
    try {
        const response = await fetch('/api/checklists/inspection/update/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(updatedData)
        });
        
        if (response.ok) {
            // Mostrar modal de sucesso
            const modal = new bootstrap.Modal(document.getElementById('completion-modal'));
            
            // Atualizar estatísticas no modal
            const compliantCount = updatedData.respostas.filter(r => r.conformidade).length;
            const nonCompliantCount = updatedData.respostas.length - compliantCount;
            
            document.getElementById('total-answered').textContent = updatedData.respostas.length;
            document.getElementById('compliant-count-modal').textContent = compliantCount;
            document.getElementById('non-compliant-count-modal').textContent = nonCompliantCount;
            
            modal.show();
        } else {
            throw new Error('Erro ao atualizar inspeção');
        }
    } catch (error) {
        console.error('Erro:', error);
        showError('Falha ao atualizar inspeção');
    } finally {
        toggleSpinner('update-btn', false);
    }
}

// Função para mostrar erro
function showError(message) {
    ToastBottomEnd.fire({
        icon: 'error',
        title: message,
    });
}

// Função para atualizar o progresso
function updateProgress() {
    const questionCards = document.querySelectorAll('.question-card');
    const answeredCount = questionCards.length; // Todas estão respondidas em modo de edição
    
    const compliantCount = Array.from(questionCards).filter(card => {
        const index = card.getAttribute('data-index');
        return document.getElementById(`conformidade-${index}`).value === 'true';
    }).length;
    
    const nonCompliantCount = answeredCount - compliantCount;
    
    document.getElementById('progress-text').textContent = `${answeredCount} de ${questionCards.length} questões respondidas`;
    document.getElementById('compliant-count').textContent = compliantCount;
    document.getElementById('non-compliant-count').textContent = nonCompliantCount;
}

// Configurar o botão de atualização
function setupUpdateButton() {
    document.getElementById('update-btn').addEventListener('click', submitUpdates);
}

// Carregar os dados quando a página for carregada
window.addEventListener('DOMContentLoaded', async () => {
    const inspectionData = await loadInspectionData();
    if (inspectionData) {
        populateFormWithData(inspectionData);
        setupUpdateButton();
    }
});