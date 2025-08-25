import { getCookie, toggleSpinner, ToastBottomEnd, fileToBase64 } from "../../../static/js/scripts.js";

// Obter o ID da inspeção da URL
const pathParts = window.location.pathname.split('/');
const inspectionId = pathParts[pathParts.length - 2];

// Variável para armazenar as fotos
let currentPhotos = {};
let newPhotos = {};
let photosToRemove = [];

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

// Função para preencher o formulário com os dados existentes
function populateFormWithData(inspectionData) {
    // Atualizar informações do cabeçalho
    console.log(inspectionData);
    document.getElementById('checklist-title').textContent = `Editando: ${inspectionData.checklist.nome}`;
    document.getElementById('checklist-description').textContent = inspectionData.checklist.descricao;
    document.getElementById('questions-info').textContent = `${inspectionData.respostas.length} questões`;
    document.getElementById('inspection-info').textContent = 
        `Data: ${new Date(inspectionData.data_inspecao).toLocaleDateString('pt-BR')} | Inspetor: ${inspectionData.inspetor.nome}`;
    
    // Inicializar estruturas de fotos
    currentPhotos = {};
    newPhotos = {};
    photosToRemove = [];
    
    // Preencher as questões com as respostas existentes
    const questionsContainer = document.getElementById('questions-container');
    
    let html = '';
    inspectionData.respostas.forEach((resposta, index) => {
        const conformeClass = resposta.conformidade ? 'btn-success' : 'btn-outline-success';
        const naoConformeClass = !resposta.conformidade ? 'btn-danger' : 'btn-outline-danger';
        
        // Armazenar fotos atuais
        currentPhotos[resposta.pergunta_id] = resposta.fotos || [];
        
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
                
                <div class="mb-3">
                    <label for="observacao-${index}" class="form-label">Observações:</label>
                    <textarea class="form-control" id="observacao-${index}" rows="2" 
                        placeholder="Adicione observações relevantes...">${resposta.observacao || ''}</textarea>
                </div>
                
                <!-- Seção de Fotos -->
                <div class="mb-3">
                    <label class="form-label">Fotos:</label>
                    <div class="photos-container mt-2 d-flex flex-wrap gap-2" id="photos-container-${index}" data-question-id="${resposta.pergunta_id}">
                        ${renderPhotos(resposta.fotos, resposta.pergunta_id)}
                    </div>
                    
                    <input type="file" 
                           class="form-control photo-input" 
                           id="photo-input-${index}" 
                           data-question-id="${resposta.pergunta_id}"
                           accept="image/*" 
                           multiple
                           style="display: none;">
                    
                    <button type="button" 
                            class="btn btn-outline-primary btn-sm add-photo-btn"
                            data-question-id="${resposta.pergunta_id}">
                        <i class="bi bi-camera me-1"></i>Adicionar Fotos
                    </button>
                    <small class="text-muted d-block mt-1">Você pode selecionar múltiplas fotos de uma vez</small>
                </div>
            </div>
        </div>
        `;
    });
    
    questionsContainer.innerHTML = html;
    document.getElementById('footer-card').classList.remove('d-none');
    setupConformityButtons();
    setupPhotoHandlers();
    updateProgress();
}

// Função para renderizar as fotos
function renderPhotos(fotos, questionId) {
    if (!fotos || fotos.length === 0) {
        return '<div class="text-muted">Nenhuma foto adicionada</div>';
    }
    
    return fotos.map(foto => `
        <div class="photo-thumbnail me-2 mb-2" data-photo-id="${foto.id}">
            <img src="${foto.url}" alt="${foto.descricao}" class="img-thumbnail" style="width: 80px; height: 80px; object-fit: cover;">
            <button type="button" class="btn btn-sm btn-danger remove-photo-btn" data-photo-id="${foto.id}" data-question-id="${questionId}">
                <i class="bi bi-x"></i>
            </button>
        </div>
    `).join('');
}

// Configurar handlers para fotos
function setupPhotoHandlers() {
    // Botão para adicionar fotos
    document.querySelectorAll('.add-photo-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const questionId = this.getAttribute('data-question-id');
            document.getElementById(`photo-input-${getIndexByQuestionId(questionId)}`).click();
        });
    });
    
    // Input de arquivo
    document.querySelectorAll('.photo-input').forEach(input => {
        input.addEventListener('change', function(e) {
            const questionId = this.getAttribute('data-question-id');
            handlePhotoUpload(e.target.files, questionId);
            this.value = ''; // Reset input
        });
    });
    
    // Configurar event listeners iniciais para fotos existentes
    document.querySelectorAll('.question-card').forEach(card => {
        const questionId = card.getAttribute('data-question-id');
        setupPhotoEventListeners(questionId);
    });
}

// Configurar event listeners para fotos de uma questão específica
function setupPhotoEventListeners(questionId) {
    // Botão para remover fotos existentes
    document.querySelectorAll(`.remove-photo-btn[data-question-id="${questionId}"]`).forEach(btn => {
        btn.addEventListener('click', function() {
            const photoId = this.getAttribute('data-photo-id');
            removePhoto(photoId, questionId);
        });
    });
    
    // Botão para remover novas fotos
    document.querySelectorAll(`.remove-new-photo-btn[data-question-id="${questionId}"]`).forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            removeNewPhoto(questionId, index);
        });
    });
}

// Função para obter índice pela questão ID
function getIndexByQuestionId(questionId) {
    const card = document.querySelector(`.question-card[data-question-id="${questionId}"]`);
    return card ? card.getAttribute('data-index') : null;
}

// Função para lidar com upload de fotos
async function handlePhotoUpload(files, questionId) {
    if (!newPhotos[questionId]) {
        newPhotos[questionId] = [];
    }
    
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
        showError('Por favor, selecione apenas arquivos de imagem.');
        return;
    }
    
    // Mostrar loading
    const container = document.querySelector(`#photos-container-${getIndexByQuestionId(questionId)}`);
    const originalContent = container.innerHTML;
    container.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm"></div> Processando fotos...</div>';
    
    try {
        for (let file of validFiles) {
            const base64Data = await fileToBase64(file);
            newPhotos[questionId].push({
                file: file,
                base64: base64Data,
                nome: file.name,
                tipo: file.type,
                tamanho: file.size
            });
        }
        
        // Atualizar visualização
        updatePhotoPreview(questionId);
        
        if (validFiles.length > 1) {
            showSuccess(`${validFiles.length} fotos adicionadas com sucesso!`);
        } else {
            showSuccess('Foto adicionada com sucesso!');
        }
        
    } catch (error) {
        console.error('Erro ao processar fotos:', error);
        container.innerHTML = originalContent;
        showError('Erro ao processar as fotos');
    }
}

// Atualizar visualização de fotos
function updatePhotoPreview(questionId) {
    const index = getIndexByQuestionId(questionId);
    const container = document.querySelector(`#photos-container-${index}`);
    const current = currentPhotos[questionId] || [];
    const newOnes = newPhotos[questionId] || [];
    
    let html = '';
    
    // Fotos existentes (não removidas) - CORREÇÃO AQUI
    current.forEach(foto => {
        // Verificar se a foto NÃO está na lista de remoção
        if (!photosToRemove.includes(foto.id.toString())) {
            html += `
                <div class="photo-thumbnail me-2 mb-2" data-photo-id="${foto.id}">
                    <img src="${foto.url}" alt="${foto.descricao}" class="img-thumbnail" style="width: 80px; height: 80px; object-fit: cover;">
                    <button type="button" class="btn btn-sm btn-danger remove-photo-btn" data-photo-id="${foto.id}" data-question-id="${questionId}">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            `;
        }
    });
    
    // Novas fotos
    newOnes.forEach((foto, newIndex) => {
        html += `
            <div class="photo-thumbnail me-2 mb-2" data-new-photo-index="${newIndex}">
                <img src="${foto.base64}" alt="${foto.nome}" class="img-thumbnail" style="width: 80px; height: 80px; object-fit: cover;">
                <button type="button" class="btn btn-sm btn-danger remove-new-photo-btn" data-question-id="${questionId}" data-index="${newIndex}">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `;
    });
    
    if (html === '') {
        html = '<div class="text-muted">Nenhuma foto adicionada</div>';
    }
    
    container.innerHTML = html;
    
    // Reconfigurar event listeners
    setupPhotoEventListeners(questionId);
}

// Remover foto existente
function removePhoto(photoId, questionId) {
    // Converter para string para garantir comparação correta
    const photoIdStr = photoId.toString();
    
    if (!photosToRemove.includes(photoIdStr)) {
        photosToRemove.push(photoIdStr);
        updatePhotoPreview(questionId);
        showInfo('Foto removida');
    }
}

// Remover nova foto
function removeNewPhoto(questionId, index) {
    if (newPhotos[questionId] && newPhotos[questionId][index]) {
        newPhotos[questionId].splice(index, 1);
        updatePhotoPreview(questionId);
        showInfo('Foto removida');
    }
}

// Função para coletar os dados atualizados
async function getUpdatedData() {
    const questionCards = document.querySelectorAll('.question-card');
    const updatedResponses = [];
    
    for (const card of questionCards) {
        const index = card.getAttribute('data-index');
        const questionId = card.getAttribute('data-question-id');
        const conformity = document.getElementById(`conformidade-${index}`).value === 'true';
        const causes = document.getElementById(`causes-${index}`).value;
        const actions = document.getElementById(`actions-${index}`).value;
        const observation = document.getElementById(`observacao-${index}`).value;
        
        // Processar fotos para esta questão
        const fotosBase64 = [];
        if (newPhotos[questionId]) {
            for (const foto of newPhotos[questionId]) {
                fotosBase64.push({
                    nome: foto.nome,
                    tipo: foto.tipo,
                    dados: foto.base64
                });
            }
        }
        
        updatedResponses.push({
            pergunta_id: parseInt(questionId),
            conformidade: conformity,
            causa: causes,
            acao: actions,
            observacao: observation,
            fotos: fotosBase64
        });
    }
    
    return {
        inspection_id: parseInt(inspectionId),
        respostas: updatedResponses,
        fotos_remover: photosToRemove
    };
}

// Função para enviar as atualizações
async function submitUpdates() {
    const updatedData = await getUpdatedData();

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
        
        const result = await response.json();
        
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
            throw new Error(result.error || 'Erro ao atualizar inspeção');
        }
    } catch (error) {
        console.error('Erro:', error);
        showError(error.message || 'Falha ao atualizar inspeção');
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

// Função para mostrar sucesso
function showSuccess(message) {
    ToastBottomEnd.fire({
        icon: 'success',
        title: message,
    });
}

// Função para mostrar informação
function showInfo(message) {
    ToastBottomEnd.fire({
        icon: 'info',
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