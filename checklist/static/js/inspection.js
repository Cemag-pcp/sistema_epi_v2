import { getCookie, toggleSpinner, ToastBottomEnd } from "../../../static/js/scripts.js";
import { compressImage } from "./image-utils.js";
import { criarRascunho } from "./inspection-draft.js";

const RASCUNHO_VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;
const SALVAR_APOS_MS = 400;

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', function() {
    document.body.classList.add('inspection-page');

    // Obter o ID do checklist da URL
    const pathParts = window.location.pathname.split('/');
    const checklistId = pathParts[pathParts.length - 2];
    const userId = document.getElementById('inspection-root').dataset.userId || 'anon';

    // Elementos da interface
    const questionsContainer = document.getElementById('questions-container');
    const footerCard = document.getElementById('footer-card');
    const submitBtn = document.getElementById('submit-btn');
    const draftBanner = document.getElementById('draft-banner');
    const completionModal = new bootstrap.Modal(document.getElementById('completion-modal'));

    // Modal de confirmação de exclusão de foto
    let deletePhotoModal, confirmDeleteBtn;
    const deleteModalEl = document.getElementById('deletePhotoConfirmModal');
    if (deleteModalEl) {
        deletePhotoModal = new bootstrap.Modal(deleteModalEl);
        confirmDeleteBtn = document.getElementById('confirmPhotoDeleteBtn');

        confirmDeleteBtn.addEventListener('click', function() {
            const questionId = this.dataset.questionId;
            const photoId = this.dataset.photoId;
            if (questionId && photoId) {
                handleRemovePhotoClick(questionId, photoId);
                deletePhotoModal.hide();
            }
        });
    }

    // Modal de visualização de imagem
    let imageViewerModal, modalImageContent;
    const imageViewerModalEl = document.getElementById('imageViewerModal');
    if (imageViewerModalEl) {
        imageViewerModal = new bootstrap.Modal(imageViewerModalEl);
        modalImageContent = document.getElementById('modal-image-content');
    }

    // Ordem de serviço (modal de escolha ao enviar, só para checklists com máquina)
    const osModalEl = document.getElementById('os-modal');
    const osModal = new bootstrap.Modal(osModalEl);
    const osChoiceYes = document.getElementById('os-choice-yes');
    const osFields = document.getElementById('os-fields');
    const osDescription = document.getElementById('os-description');

    // Câmera (modal com pré-visualização ao vivo)
    const cameraModalEl = document.getElementById('cameraModal');
    const cameraModal = new bootstrap.Modal(cameraModalEl);
    const cameraVideo = document.getElementById('camera-video');
    const cameraCaptureBtn = document.getElementById('camera-capture-btn');
    const cameraSwitchBtn = document.getElementById('camera-switch-btn');
    let cameraStream = null;
    let cameraQuestionId = null;
    let cameraFacing = 'environment';
    let cameraAdded = 0;

    // Estado da aplicação
    let checklistData = null;
    let questions = [];
    let responses = {};

    // Rascunho: o preenchimento é salvo no aparelho para sobreviver a recarregamentos
    const rascunho = criarRascunho(`inspecao-${userId}-${checklistId}`);
    let rascunhoPronto = false; // só salva depois de restaurar, para não apagar o rascunho existente
    let rascunhoEncerrado = false; // enviado ou descartado: nada mais deve ser salvo
    let timerSalvar = null;

    function novaResposta() {
        return { conformidade: null, observacao: '', causa: '', acao: '', fotos: [] };
    }

    function respostaVazia(r) {
        return r.conformidade === null && !r.observacao && !r.causa && !r.acao && r.fotos.length === 0;
    }

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
            return;
        }
        await restaurarRascunho();
    }

    function questionHtml(pergunta, index) {
        const id = pergunta.id;
        return `
            <div class="card mb-3 question-card" id="question-${id}" data-status="">
                <div class="card-body p-3 p-md-4">
                    <div class="d-flex gap-2 align-items-start mb-3">
                        <span class="badge bg-dark mt-1">#${index + 1}</span>
                        <h5 class="card-title h6 mb-0">${escapeHtml(pergunta.texto)}</h5>
                    </div>

                    <div class="compliance-group mb-3">
                        <button type="button" class="btn btn-outline-success compliance-btn" data-question="${id}" data-compliant="true">
                            <i class="bi bi-check-circle me-2"></i>Conforme
                        </button>
                        <button type="button" class="btn btn-outline-danger compliance-btn" data-question="${id}" data-compliant="false">
                            <i class="bi bi-x-circle me-2"></i>Não Conforme
                        </button>
                    </div>

                    <div class="nc-fields mb-3">
                        <div class="row g-3">
                            <div class="col-sm-6">
                                <label for="causes-${id}" class="form-label">Causa(s) de reprovação</label>
                                <input class="form-control" id="causes-${id}" data-question="${id}" data-field="causa">
                            </div>
                            <div class="col-sm-6">
                                <label for="actions-${id}" class="form-label">Ação(ões) corretiva(s)</label>
                                <input class="form-control" id="actions-${id}" data-question="${id}" data-field="acao">
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label for="notes-${id}" class="form-label">Observações</label>
                        <textarea class="form-control" id="notes-${id}" data-question="${id}" data-field="observacao" rows="2" placeholder="Adicione observações sobre esta questão..."></textarea>
                    </div>

                    <div>
                        <label class="form-label">Fotos</label>
                        <input type="file" class="d-none photo-input" id="photo-input-${id}" data-question="${id}" accept="image/*" multiple>
                        <input type="file" class="d-none photo-input" id="photo-camera-${id}" data-question="${id}" accept="image/*" capture="environment">
                        <div class="d-flex flex-wrap gap-2">
                            <button type="button" class="btn btn-outline-primary add-photo-btn" data-question="${id}" data-source="camera">
                                <i class="bi bi-camera me-1"></i>Tirar foto
                            </button>
                            <button type="button" class="btn btn-outline-primary add-photo-btn" data-question="${id}" data-source="gallery">
                                <i class="bi bi-images me-1"></i>Adicionar Fotos
                            </button>
                        </div>
                        <div class="photo-preview-container mt-2" id="photo-preview-${id}"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // Função para exibir o checklist
    function displayChecklist() {
        if (!checklistData.data) return;

        // Atualizar título
        document.getElementById('checklist-title').textContent = checklistData.data.nome;
        document.getElementById('checklist-description').textContent = checklistData.data.descricao;
        document.getElementById('checklist-complete-title').textContent = checklistData.data.nome;
        document.getElementById('questions-info').textContent = `${checklistData.data.perguntas.length} questões`;

        questions = [];
        responses = {};
        questionsContainer.innerHTML = checklistData.data.perguntas
            .map((pergunta, index) => {
                questions.push(pergunta);
                responses[pergunta.id] = novaResposta();
                return questionHtml(pergunta, index);
            })
            .join('');

        // Mostrar rodapé
        footerCard.classList.remove('d-none');
        updateProgress();
    }

    // Eventos por delegação: os cards são criados dinamicamente
    questionsContainer.addEventListener('click', function(e) {
        const complianceBtn = e.target.closest('.compliance-btn');
        if (complianceBtn) {
            handleComplianceClick(complianceBtn);
            return;
        }

        const addPhotoBtn = e.target.closest('.add-photo-btn');
        if (addPhotoBtn) {
            const questionId = addPhotoBtn.dataset.question;
            if (addPhotoBtn.dataset.source === 'camera') {
                abrirCamera(questionId);
            } else {
                document.getElementById(`photo-input-${questionId}`).click();
            }
            return;
        }

        const removeBtn = e.target.closest('.remove-photo-btn');
        if (removeBtn) {
            if (confirmDeleteBtn && deletePhotoModal) {
                confirmDeleteBtn.dataset.questionId = removeBtn.dataset.questionId;
                confirmDeleteBtn.dataset.photoId = removeBtn.dataset.photoId;
                deletePhotoModal.show();
            }
            return;
        }

        const thumb = e.target.closest('.photo-thumb');
        if (thumb && modalImageContent && imageViewerModal) {
            modalImageContent.src = thumb.src;
            imageViewerModal.show();
        }
    });

    questionsContainer.addEventListener('input', function(e) {
        const field = e.target.dataset.field;
        if (!field) return;
        responses[e.target.dataset.question][field] = e.target.value;
        agendarSalvar();
    });

    questionsContainer.addEventListener('change', function(e) {
        if (e.target.classList.contains('photo-input')) {
            handlePhotoInputChange(e);
        }
    });

    // Aplica o estado de conformidade na tela (botões e cor da borda do card)
    function aplicarConformidade(questionId, isCompliant) {
        document.querySelectorAll(`.compliance-btn[data-question="${questionId}"]`).forEach(btn => {
            if (btn.dataset.compliant === 'true') {
                btn.classList.toggle('btn-success', isCompliant);
                btn.classList.toggle('btn-outline-success', !isCompliant);
            } else {
                btn.classList.toggle('btn-danger', !isCompliant);
                btn.classList.toggle('btn-outline-danger', isCompliant);
            }
        });
        document.getElementById(`question-${questionId}`).dataset.status = isCompliant ? 'ok' : 'nc';
        responses[questionId].conformidade = isCompliant;
    }

    function handleComplianceClick(btn) {
        aplicarConformidade(btn.dataset.question, btn.dataset.compliant === 'true');
        updateProgress();
        agendarSalvar();
    }

    // Adiciona a miniatura de uma foto e a registra no estado (usado ao escolher e ao restaurar)
    function adicionarFoto(questionId, foto) {
        responses[questionId].fotos.push(foto);
        document.getElementById(`photo-preview-${questionId}`).insertAdjacentHTML('beforeend', `
            <div class="photo-preview-item" data-photo-id="${foto.id}">
                <img src="${foto.preview}" class="img-thumbnail photo-thumb" alt="Foto anexada">
                <button type="button" class="btn btn-danger remove-photo-btn" data-question-id="${questionId}" data-photo-id="${foto.id}" aria-label="Remover foto">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        `);
    }

    // Valida, comprime e anexa uma imagem (vinda da galeria, do seletor ou da câmera)
    function adicionarArquivo(questionId, file) {
        if (!file.type.startsWith('image/')) {
            showError('Por favor, selecione apenas arquivos de imagem.');
            return Promise.resolve();
        }
        if (file.size > 20 * 1024 * 1024) {
            showError('A imagem deve ter no máximo 20MB.');
            return Promise.resolve();
        }

        // Comprime já ao selecionar: o envio fica leve e o rascunho ocupa menos espaço
        return compressImage(file).then(function(dataUrl) {
            adicionarFoto(questionId, {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                nome: file.name,
                tipo: dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : file.type,
                preview: dataUrl
            });
            agendarSalvar();
        }).catch(function() {
            showError('Não foi possível processar a imagem.');
        });
    }

    // Manipulador de seleção de arquivo de foto (galeria ou câmera nativa)
    function handlePhotoInputChange(e) {
        const questionId = e.target.dataset.question;
        const files = Array.from(e.target.files);
        e.target.value = '';
        files.forEach(file => adicionarArquivo(questionId, file));
    }

    // ---- Câmera ------------------------------------------------------------------------------

    async function iniciarCamera() {
        pararCamera();
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: cameraFacing, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
        });
        cameraVideo.srcObject = cameraStream;
        cameraCaptureBtn.disabled = true;
        cameraVideo.onloadedmetadata = () => { cameraCaptureBtn.disabled = false; };
        await cameraVideo.play().catch(() => {});
    }

    // Desliga a câmera (apaga a luz de "em uso")
    function pararCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        cameraVideo.srcObject = null;
    }

    function atualizarContadorCamera() {
        document.getElementById('camera-count').textContent =
            cameraAdded === 0 ? 'Nenhuma foto tirada ainda' : `${cameraAdded} foto${cameraAdded > 1 ? 's' : ''} adicionada${cameraAdded > 1 ? 's' : ''}`;
    }

    async function abrirCamera(questionId) {
        // Sem câmera acessível pela página (ex.: http fora do localhost): usa a câmera nativa do aparelho
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            document.getElementById(`photo-camera-${questionId}`).click();
            return;
        }

        cameraQuestionId = questionId;
        cameraAdded = 0;
        atualizarContadorCamera();

        try {
            await iniciarCamera(); // pede a permissão antes de abrir o modal
        } catch (error) {
            console.warn('Câmera indisponível:', error);
            showError(
                error.name === 'NotAllowedError'
                    ? 'Permissão da câmera negada. Libere o acesso ou use "Adicionar Fotos".'
                    : 'Não foi possível abrir a câmera. Use "Adicionar Fotos".'
            );
            return;
        }

        cameraModal.show();
        try {
            const dispositivos = await navigator.mediaDevices.enumerateDevices();
            cameraSwitchBtn.classList.toggle('d-none', dispositivos.filter(d => d.kind === 'videoinput').length < 2);
        } catch (error) {
            cameraSwitchBtn.classList.add('d-none');
        }
    }

    cameraCaptureBtn.addEventListener('click', function() {
        const largura = cameraVideo.videoWidth;
        const altura = cameraVideo.videoHeight;
        if (!largura || !altura) return;

        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        canvas.getContext('2d').drawImage(cameraVideo, 0, 0, largura, altura);

        // Efeito de "flash" para confirmar que a foto foi tirada
        const flash = document.getElementById('camera-flash');
        flash.classList.add('on');
        setTimeout(() => flash.classList.remove('on'), 150);

        canvas.toBlob(async function(blob) {
            if (!blob) {
                showError('Não foi possível capturar a foto.');
                return;
            }
            const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
            await adicionarArquivo(cameraQuestionId, file);
            cameraAdded++;
            atualizarContadorCamera();
        }, 'image/jpeg', 0.92);
    });

    cameraSwitchBtn.addEventListener('click', async function() {
        cameraFacing = cameraFacing === 'environment' ? 'user' : 'environment';
        try {
            await iniciarCamera();
        } catch (error) {
            showError('Não foi possível trocar de câmera.');
            cameraFacing = cameraFacing === 'environment' ? 'user' : 'environment';
            await iniciarCamera().catch(() => {});
        }
    });

    cameraModalEl.addEventListener('hidden.bs.modal', pararCamera);

    function handleRemovePhotoClick(questionId, photoId) {
        if (!questionId || !photoId) {
            console.error('IDs da foto ou da questão não fornecidos para remoção.');
            return;
        }

        const photoElement = document.querySelector(`.photo-preview-item[data-photo-id="${photoId}"]`);
        if (photoElement) {
            photoElement.remove();
        }

        if (responses[questionId] && responses[questionId].fotos) {
            responses[questionId].fotos = responses[questionId].fotos.filter(photo => photo.id.toString() !== photoId.toString());
        }
        agendarSalvar();
    }

    function updateProgress() {
        const answered = Object.values(responses).filter(r => r.conformidade !== null).length;
        const compliant = Object.values(responses).filter(r => r.conformidade === true).length;
        const nonCompliant = Object.values(responses).filter(r => r.conformidade === false).length;

        // "questões" some no celular para o texto caber numa linha só
        document.getElementById('progress-text').innerHTML =
            `${answered} de ${questions.length} <span class="d-none d-sm-inline">questões </span>respondidas`;
        document.getElementById('progress-bar').style.width = questions.length ? `${(answered / questions.length) * 100}%` : '0%';
        document.getElementById('compliant-count').textContent = compliant;
        document.getElementById('non-compliant-count').textContent = nonCompliant;

        document.getElementById('total-answered').textContent = answered;
        document.getElementById('compliant-count-modal').textContent = compliant;
        document.getElementById('non-compliant-count-modal').textContent = nonCompliant;
    }

    // ---- Rascunho ----------------------------------------------------------------------------

    function agendarSalvar() {
        if (!rascunhoPronto || rascunhoEncerrado) return;
        clearTimeout(timerSalvar);
        timerSalvar = setTimeout(salvarRascunho, SALVAR_APOS_MS);
    }

    async function salvarRascunho() {
        clearTimeout(timerSalvar);
        if (!rascunhoPronto || rascunhoEncerrado) return;

        const respostas = {};
        Object.entries(responses).forEach(([id, r]) => {
            if (!respostaVazia(r)) respostas[id] = r;
        });

        try {
            if (Object.keys(respostas).length === 0) {
                await rascunho.limpar();
                mostrarStatusRascunho('');
            } else {
                await rascunho.salvar({ salvoEm: Date.now(), respostas });
                mostrarStatusRascunho(`Rascunho salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
            }
        } catch (error) {
            console.warn('Não foi possível salvar o rascunho:', error);
        }
    }

    function mostrarStatusRascunho(texto) {
        const status = document.getElementById('draft-status');
        status.textContent = texto;
        status.classList.toggle('d-none', !texto);
    }

    async function restaurarRascunho() {
        let salvo = null;
        try {
            salvo = await rascunho.carregar();
            if (salvo && Date.now() - salvo.salvoEm > RASCUNHO_VALIDADE_MS) {
                await rascunho.limpar();
                salvo = null;
            }
        } catch (error) {
            console.warn('Não foi possível carregar o rascunho:', error);
        }

        let restauradas = 0;
        if (salvo && salvo.respostas) {
            Object.entries(salvo.respostas).forEach(([id, r]) => {
                if (!responses[id]) return; // pergunta que não existe mais no checklist

                responses[id].observacao = r.observacao || '';
                responses[id].causa = r.causa || '';
                responses[id].acao = r.acao || '';
                document.getElementById(`notes-${id}`).value = responses[id].observacao;
                document.getElementById(`causes-${id}`).value = responses[id].causa;
                document.getElementById(`actions-${id}`).value = responses[id].acao;

                if (typeof r.conformidade === 'boolean') aplicarConformidade(id, r.conformidade);
                (r.fotos || []).forEach(foto => adicionarFoto(id, foto));
                restauradas++;
            });
            updateProgress();
        }

        rascunhoPronto = true;
        if (restauradas > 0) {
            const respondidas = Object.values(responses).filter(r => r.conformidade !== null).length;
            document.getElementById('draft-banner-text').textContent =
                `Rascunho recuperado: ${respondidas} de ${questions.length} questões respondidas. Continue de onde parou.`;
            draftBanner.classList.remove('d-none');
        }
    }

    document.getElementById('discard-draft-btn').addEventListener('click', async function() {
        const confirmacao = await Swal.fire({
            title: 'Descartar rascunho?',
            text: 'As respostas, observações e fotos preenchidas serão apagadas.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Descartar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc3545',
        });
        if (!confirmacao.isConfirmed) return;

        rascunhoEncerrado = true;
        clearTimeout(timerSalvar);
        await rascunho.limpar();
        window.location.reload();
    });

    // Celular: ao trocar de aba/app o navegador pode descartar a página; salva antes disso
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') salvarRascunho();
    });
    window.addEventListener('pagehide', function() {
        pararCamera();
        salvarRascunho();
    });

    // ---- Envio -------------------------------------------------------------------------------

    async function submitInspection() {
        const unanswered = Object.entries(responses).filter(([id, r]) => r.conformidade === null);

        if (unanswered.length > 0) {
            showError('Por favor, responda todas as questões antes de enviar.');
            const firstUnansweredId = unanswered[0][0];
            document.getElementById(`question-${firstUnansweredId}`).scrollIntoView({ behavior: 'smooth' });
            return;
        }

        // Checklist com máquina: o usuário escolhe se quer abrir uma OS antes de enviar
        if (maquinaDoChecklist()) {
            prepararModalOs();
            osModal.show();
            return;
        }
        await enviarInspecao('submit-btn', null);
    }

    function maquinaDoChecklist() {
        return checklistData && checklistData.data ? checklistData.data.maquina : null;
    }

    function mostrarErroOs(mensagem) {
        const erro = document.getElementById('os-error');
        erro.textContent = mensagem;
        erro.classList.toggle('d-none', !mensagem);
    }

    function prepararModalOs() {
        const naoConformes = Object.values(responses).filter(r => r.conformidade === false).length;
        const dica = document.getElementById('os-nc-hint');
        dica.textContent = naoConformes
            ? `Este checklist tem ${naoConformes} item${naoConformes > 1 ? 's' : ''} não conforme${naoConformes > 1 ? 's' : ''}.`
            : '';
        dica.classList.toggle('d-none', !naoConformes);

        document.getElementById('os-machine-name').textContent = maquinaDoChecklist().nome;
        // Sempre começa em "Não abrir OS": abrir uma ordem é uma escolha explícita
        document.getElementById('os-choice-no').checked = true;
        osFields.classList.add('d-none');
        osDescription.value = '';
        mostrarErroOs('');
    }

    document.querySelectorAll('input[name="os-choice"]').forEach(radio => {
        radio.addEventListener('change', function() {
            osFields.classList.toggle('d-none', !osChoiceYes.checked);
            if (osChoiceYes.checked) osDescription.focus();
        });
    });

    document.getElementById('os-confirm-btn').addEventListener('click', async function() {
        let os = null;
        if (osChoiceYes.checked) {
            const descricao = osDescription.value.trim();
            if (!descricao) {
                mostrarErroOs('Descreva o problema para abrir a ordem de serviço.');
                osDescription.focus();
                return;
            }
            os = { descricao };
        }
        await enviarInspecao('os-confirm-btn', os);
    });

    function fecharModalOs() {
        if (!osModalEl.classList.contains('show')) return Promise.resolve();
        return new Promise(resolve => {
            osModalEl.addEventListener('hidden.bs.modal', resolve, { once: true });
            osModal.hide();
        });
    }

    function mostrarResultadoOs(os) {
        const resultado = document.getElementById('os-result');
        if (!os) {
            resultado.classList.add('d-none');
            return;
        }
        resultado.className = `alert mb-3 ${os.aberta ? 'alert-success' : 'alert-warning'}`;
        resultado.textContent = os.aberta
            ? `Ordem de serviço aberta na manutenção${os.numero ? ` (nº ${os.numero})` : ''}.`
            : `A inspeção foi salva, mas não foi possível abrir a ordem de serviço: ${os.erro}. Abra-a manualmente no sistema de manutenção.`;
    }

    async function enviarInspecao(botaoId, os) {
        toggleSpinner(botaoId, true);

        try {
            const inspectionData = {
                checklist: checklistId,
                respostas: Object.entries(responses).map(([perguntaId, resposta]) => ({
                    pergunta: parseInt(perguntaId),
                    conformidade: resposta.conformidade,
                    observacao: resposta.observacao,
                    causa: resposta.causa,
                    acao: resposta.acao,
                    texto_pergunta_historico: questions.find(q => q.id == perguntaId).texto,
                    fotos: resposta.fotos.map(foto => ({
                        nome: foto.nome,
                        tipo: foto.tipo,
                        dados: foto.preview.split(',')[1]  // já comprimida ao selecionar
                    }))
                }))
            };
            if (os) {
                inspectionData.abrir_os = true;
                inspectionData.descricao_os = os.descricao;
            }

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

            // Enviada com sucesso: o rascunho não é mais necessário
            rascunhoEncerrado = true;
            clearTimeout(timerSalvar);
            await rascunho.limpar();
            draftBanner.classList.add('d-none');

            mostrarResultadoOs(result.os);
            await fecharModalOs();
            completionModal.show();

        } catch (error) {
            const mensagem = error.message || 'Erro ao enviar a inspeção';
            // Dentro do modal da OS o aviso ficaria por cima dos botões: mostra no próprio modal
            if (botaoId === 'os-confirm-btn' && osChoiceYes.checked) {
                mostrarErroOs(mensagem);
            } else {
                showError(mensagem);
            }
        } finally {
            toggleSpinner(botaoId, false);
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
