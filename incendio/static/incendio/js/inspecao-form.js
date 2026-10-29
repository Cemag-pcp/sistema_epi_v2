import { compressImage } from '/static/js/image-utils.js';
import { api, esc, badgeStatus, ToastBottomEnd } from './utils.js';

const dados = JSON.parse(document.getElementById('dados-inspecao').textContent);
const { tipo, equipamento } = dados;
const inspecaoExistente = dados.inspecao; // preenchida quando é edição

const container = document.getElementById('questions-container');
const submitBtn = document.getElementById('submit-btn');
const observacao = document.getElementById('observacao');

// key -> { rotulo, ajuda, resultado: 'ok'|'nok'|'na'|null, ...extras }
const itens = new Map();
let fotosNovas = [];        // { id, nome, dados }
let fotosExistentes = [];   // { id, url, nome }
const fotosRemover = [];

// ---- Montagem dos itens ---------------------------------------------------------------------

function montarItensExtintor() {
    const validade = [];
    if (equipamento.proxima_recarga_display) {
        validade.push(`Próx. recarga ${equipamento.proxima_recarga_display}${equipamento.recarga_vencida ? ' (vencida)' : ''}`);
    }
    if (equipamento.teste_hidrostatico_ano) {
        validade.push(`Teste hidrostático ${equipamento.teste_hidrostatico_ano}${equipamento.teste_hidrostatico_vencido ? ' (vencido)' : ''}`);
    }
    const ajudaValidade = validade.length
        ? `${validade.join(' • ')} — sugerido pelo cadastro: <strong>${{ ok: 'OK', nok: 'NOK', na: 'N/A' }[equipamento.situacao_sugerida]}</strong>`
        : 'Sem datas no cadastro.';

    const existente = campo => inspecaoExistente?.itens.find(i => i.campo === campo)?.resultado ?? null;
    const novo = !inspecaoExistente;

    itens.set('situacao', {
        rotulo: 'Situação (validade do extintor)', ajuda: ajudaValidade,
        resultado: novo ? equipamento.situacao_sugerida : existente('situacao'),
    });
    itens.set('estado', {
        rotulo: 'Estado', ajuda: 'Cilindro sem amassados/corrosão, mangueira e difusor em bom estado, sinalização e acesso desobstruídos.',
        resultado: existente('estado'),
    });
    itens.set('manometro', {
        rotulo: 'Manômetro', ajuda: 'Ponteiro na faixa verde. Extintor de CO2 não tem manômetro: use N/A.',
        // CO2 não tem manômetro: já vem como N/A
        resultado: novo ? (equipamento.agente === 'CO2' ? 'na' : null) : existente('manometro'),
    });
    itens.set('lacre', {
        rotulo: 'Lacre íntegro', ajuda: 'Lacre e pino de segurança no lugar (NOK = lacre rompido).',
        resultado: existente('lacre'),
    });

    const detalhes = [
        equipamento.numero_cilindro ? `Cilindro ${equipamento.numero_cilindro}` : null,
        `${equipamento.agente} ${equipamento.capacidade_kg} kg`,
    ].filter(Boolean);
    document.getElementById('equipamento-detalhes').textContent = detalhes.join(' • ');
}

function montarItensHidrante() {
    itens.set('funcionamento', {
        rotulo: 'Equipamento funciona perfeitamente?', ajuda: 'Registro, válvula e conexões sem vazamento, abrigo em boas condições.',
        resultado: inspecaoExistente ? inspecaoExistente.funcionamento : null,
    });

    // Na edição os itens vêm da própria inspeção (o cadastro pode ter mudado depois)
    const componentes = inspecaoExistente
        ? inspecaoExistente.itens.map(i => ({
            itemId: i.id, componenteId: i.componente_id, nome: i.nome,
            prevista: i.quantidade_prevista, encontrada: i.quantidade_encontrada, resultado: i.resultado,
        }))
        : equipamento.componentes.map(c => ({
            itemId: null, componenteId: c.id, nome: c.nome,
            prevista: c.quantidade, encontrada: c.quantidade, resultado: null,
        }));

    componentes.forEach((c, indice) => {
        itens.set(`componente-${indice}`, {
            rotulo: c.nome,
            ajuda: c.prevista !== null ? `Quantidade prevista: ${c.prevista}` : 'Item de verificação',
            resultado: c.resultado,
            componente: c,
        });
    });

    document.getElementById('equipamento-detalhes').textContent = equipamento.componentes_display;
}

function htmlQuantidade(key, componente) {
    if (componente.prevista === null) return '';
    return `
        <div class="d-flex align-items-center gap-2 mb-3">
            <label class="small text-muted mb-0" for="qtd-${key}">Quantidade encontrada</label>
            <input type="number" min="0" class="form-control quantidade-encontrada" id="qtd-${key}" data-key="${key}"
                   style="max-width: 110px" value="${componente.encontrada ?? ''}">
        </div>`;
}

function renderItens() {
    container.innerHTML = [...itens.entries()].map(([key, item], indice) => `
        <div class="card mb-3 question-card" id="question-${key}">
            <div class="card-body">
                <div class="d-flex gap-2 mb-2">
                    <span class="badge bg-light text-dark border align-self-start">${indice + 1}</span>
                    <div>
                        <div class="fw-semibold">${esc(item.rotulo)}</div>
                        <div class="small text-muted">${key === 'situacao' ? item.ajuda : esc(item.ajuda)}</div>
                    </div>
                </div>
                ${item.componente ? htmlQuantidade(key, item.componente) : ''}
                <div class="compliance-group">
                    <button type="button" class="btn btn-outline-success compliance-btn" data-key="${key}" data-value="ok">
                        <i class="bi bi-check-circle me-1"></i>OK</button>
                    <button type="button" class="btn btn-outline-danger compliance-btn" data-key="${key}" data-value="nok">
                        <i class="bi bi-x-circle me-1"></i>NOK</button>
                    <button type="button" class="btn btn-outline-secondary compliance-btn" data-key="${key}" data-value="na">
                        <i class="bi bi-dash-circle me-1"></i>N/A</button>
                </div>
            </div>
        </div>`).join('');

    itens.forEach((item, key) => aplicarResultado(key, item.resultado));
}

const COR = { ok: 'success', nok: 'danger', na: 'secondary' };
const STATUS_CARD = { ok: 'ok', nok: 'nc', na: 'na' };

function aplicarResultado(key, valor) {
    itens.get(key).resultado = valor;
    document.querySelectorAll(`.compliance-btn[data-key="${key}"]`).forEach(btn => {
        const cor = COR[btn.dataset.value];
        const selecionado = btn.dataset.value === valor;
        btn.classList.toggle(`btn-${cor}`, selecionado);
        btn.classList.toggle(`btn-outline-${cor}`, !selecionado);
    });
    const card = document.getElementById(`question-${key}`);
    if (valor) card.dataset.status = STATUS_CARD[valor]; else delete card.dataset.status;
    atualizarProgresso();
}

container.addEventListener('click', event => {
    const btn = event.target.closest('.compliance-btn');
    if (btn) aplicarResultado(btn.dataset.key, btn.dataset.value);
});

// Quantidade abaixo da prevista já marca NOK; o inspetor pode mudar se quiser
container.addEventListener('input', event => {
    const input = event.target.closest('.quantidade-encontrada');
    if (!input) return;
    const item = itens.get(input.dataset.key);
    item.componente.encontrada = input.value === '' ? null : parseInt(input.value);
    if (item.componente.encontrada !== null && item.componente.encontrada < item.componente.prevista) {
        aplicarResultado(input.dataset.key, 'nok');
    }
});

function atualizarProgresso() {
    if (!document.getElementById('progress-text')) return; // equipamento desativado: sem rodapé
    const valores = [...itens.values()].map(i => i.resultado);
    const respondidos = valores.filter(Boolean).length;
    const total = valores.length;
    document.getElementById('progress-text').textContent = `${respondidos} de ${total} itens respondidos`;
    document.getElementById('progress-bar').style.width = `${total ? (respondidos / total) * 100 : 0}%`;
    document.getElementById('ok-count').textContent = valores.filter(v => v === 'ok').length;
    document.getElementById('nok-count').textContent = valores.filter(v => v === 'nok').length;
    document.getElementById('na-count').textContent = valores.filter(v => v === 'na').length;
}

// ---- Fotos ----------------------------------------------------------------------------------

const preview = document.getElementById('fotos-preview');

function renderFotos() {
    const todas = [
        ...fotosExistentes.map(f => ({ ...f, existente: true, src: f.url })),
        ...fotosNovas.map(f => ({ ...f, existente: false, src: f.dados })),
    ];
    preview.innerHTML = todas.map(f => `
        <div class="photo-preview-item">
            <img src="${esc(f.src)}" class="rounded border photo-thumb" alt="${esc(f.nome)}">
            <button type="button" class="btn btn-danger remove-photo-btn" data-id="${esc(f.id)}" data-existente="${f.existente}" title="Remover foto">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>`).join('');
}

document.querySelectorAll('.add-photo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.source === 'camera' ? 'foto-camera' : 'foto-galeria').click();
    });
});

['foto-camera', 'foto-galeria'].forEach(id => {
    document.getElementById(id).addEventListener('change', async event => {
        const arquivos = [...event.target.files].filter(f => f.type.startsWith('image/'));
        for (const arquivo of arquivos) {
            const dadosFoto = await compressImage(arquivo);
            fotosNovas.push({ id: `${Date.now()}${Math.random().toString(36).slice(2, 8)}`, nome: arquivo.name, dados: dadosFoto });
        }
        event.target.value = '';
        renderFotos();
    });
});

const modalImagem = new bootstrap.Modal(document.getElementById('imageViewerModal'));

preview.addEventListener('click', event => {
    const remover = event.target.closest('.remove-photo-btn');
    if (remover) {
        if (remover.dataset.existente === 'true') {
            const id = parseInt(remover.dataset.id);
            fotosRemover.push(id);
            fotosExistentes = fotosExistentes.filter(f => f.id !== id);
        } else {
            fotosNovas = fotosNovas.filter(f => f.id !== remover.dataset.id);
        }
        renderFotos();
        return;
    }
    const miniatura = event.target.closest('.photo-thumb');
    if (miniatura) {
        document.getElementById('modal-image-content').src = miniatura.src;
        modalImagem.show();
    }
});

// ---- Envio ----------------------------------------------------------------------------------

function mostrarErro(mensagem) {
    document.getElementById('error-message').textContent = mensagem;
    document.getElementById('error-alert').classList.remove('d-none');
    document.getElementById('error-alert').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function montarPayload() {
    const base = {
        observacao: observacao.value,
        fotos: fotosNovas.map(f => ({ nome: f.nome, dados: f.dados })),
        fotos_remover: fotosRemover,
    };
    if (tipo === 'extintor') {
        return {
            ...base,
            extintor: equipamento.id,
            situacao: itens.get('situacao').resultado,
            estado: itens.get('estado').resultado,
            manometro: itens.get('manometro').resultado,
            lacre: itens.get('lacre').resultado,
        };
    }
    return {
        ...base,
        hidrante: equipamento.id,
        funcionamento: itens.get('funcionamento').resultado,
        itens: [...itens.values()].filter(i => i.componente).map(i => ({
            id: i.componente.itemId,
            componente_id: i.componente.componenteId,
            nome: i.componente.nome,
            quantidade_encontrada: i.componente.encontrada,
            resultado: i.resultado,
        })),
    };
}

async function enviar() {
    document.getElementById('error-alert').classList.add('d-none');

    const pendente = [...itens.entries()].find(([, item]) => !item.resultado);
    if (pendente) {
        mostrarErro(`Responda o item "${pendente[1].rotulo}" (OK, NOK ou N/A).`);
        document.getElementById(`question-${pendente[0]}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    const valores = [...itens.values()].map(i => i.resultado);
    if (valores.includes('nok') && !observacao.value.trim()) {
        mostrarErro('Há itens NOK: descreva o problema na observação.');
        observacao.focus();
        return;
    }
    if (valores.every(v => v === 'na')) {
        const { isConfirmed } = await Swal.fire({
            icon: 'warning',
            title: 'Todos os itens estão como N/A',
            text: 'A inspeção ficará como "Não avaliado". Deseja enviar mesmo assim?',
            showCancelButton: true,
            confirmButtonText: 'Enviar',
            cancelButtonText: 'Voltar',
        });
        if (!isConfirmed) return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('.spinner-border').classList.remove('d-none');
    submitBtn.querySelector('.button-text').classList.add('d-none');
    try {
        const data = inspecaoExistente
            ? await api(`/incendio/api/inspecoes/${tipo}/${inspecaoExistente.id}/`, 'PUT', montarPayload())
            : await api(`/incendio/api/inspecoes/${tipo}/`, 'POST', montarPayload());

        document.getElementById('completion-status').innerHTML = badgeStatus(data.inspecao.status, data.inspecao.status_display);
        if (data.inspecao.falta_equipamento) {
            const falta = document.getElementById('completion-falta');
            falta.textContent = `Falta equipamento: ${data.inspecao.falta_descricao}`;
            falta.classList.remove('d-none');
        }
        new bootstrap.Modal(document.getElementById('completion-modal')).show();
    } catch (error) {
        mostrarErro(error.message);
        ToastBottomEnd.fire({ icon: 'error', title: error.message });
        submitBtn.disabled = false;
    } finally {
        submitBtn.querySelector('.spinner-border').classList.add('d-none');
        submitBtn.querySelector('.button-text').classList.remove('d-none');
    }
}

// ---- Inicialização --------------------------------------------------------------------------

if (tipo === 'extintor') montarItensExtintor(); else montarItensHidrante();
renderItens();

if (inspecaoExistente) {
    observacao.value = inspecaoExistente.observacao;
    fotosExistentes = inspecaoExistente.fotos;
    renderFotos();
    const info = document.getElementById('info-edicao');
    info.textContent = `Inspeção de ${inspecaoExistente.data} feita por ${inspecaoExistente.inspetor}.`;
    info.classList.remove('d-none');
}

if (submitBtn) {
    submitBtn.addEventListener('click', enviar);
} else {
    // Equipamento desativado: só leitura
    container.querySelectorAll('button, input').forEach(el => { el.disabled = true; });
}
