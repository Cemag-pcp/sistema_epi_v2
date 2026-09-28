import { getCookie, ToastBottomEnd, toggleSpinner } from "../../../static/js/scripts.js";
import { carregarCardsChecklist, navegarParaPasta, obterPastaAtual } from "./cards-checklist.js";

document.addEventListener('DOMContentLoaded', function() {
    const novaPastaModalEl = document.getElementById('novaPastaModal');
    const renomearPastaModalEl = document.getElementById('renomearPastaModal');
    const excluirPastaModalEl = document.getElementById('excluirPastaModal');
    const moverChecklistModalEl = document.getElementById('moverChecklistModal');

    const novaPastaModal = new bootstrap.Modal(novaPastaModalEl);
    const renomearPastaModal = new bootstrap.Modal(renomearPastaModalEl);
    const excluirPastaModal = new bootstrap.Modal(excluirPastaModalEl);
    const moverChecklistModal = new bootstrap.Modal(moverChecklistModalEl);

    function mostrarErro(elementId, mensagem) {
        const el = document.getElementById(elementId);
        el.textContent = mensagem;
        el.classList.remove('d-none');
    }

    function limparErro(elementId) {
        const el = document.getElementById(elementId);
        el.textContent = '';
        el.classList.add('d-none');
    }

    // ---- Criar pasta ---------------------------------------------------------------------

    // Guarda o checklist que estava sendo movido quando o usuário clicou em "Nova pasta" a
    // partir do modal de mover, para reabri-lo (já com a pasta nova selecionada) ao terminar.
    let retomarMoverApos = null;

    document.getElementById('btn-nova-pasta').addEventListener('click', function() {
        retomarMoverApos = null;
        document.getElementById('novaPastaNome').value = '';
        limparErro('novaPastaErro');
        novaPastaModal.show();
    });

    document.getElementById('btnNovaPastaNoMover').addEventListener('click', function() {
        retomarMoverApos = {
            checklistId: document.getElementById('moverChecklistId').value,
            checklistNome: document.getElementById('moverChecklistNome').textContent,
        };
        moverChecklistModal.hide();
        document.getElementById('novaPastaNome').value = '';
        limparErro('novaPastaErro');
        novaPastaModal.show();
    });

    document.getElementById('confirmNovaPasta').addEventListener('click', async function() {
        const nome = document.getElementById('novaPastaNome').value.trim();
        if (!nome) {
            mostrarErro('novaPastaErro', 'Informe o nome da pasta.');
            return;
        }

        toggleSpinner('confirmNovaPasta', true);
        try {
            const response = await fetch('/api/checklists/pastas/add/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({ nome }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao criar pasta');

            novaPastaModal.hide();
            ToastBottomEnd.fire({ icon: 'success', title: 'Pasta criada com sucesso!' });

            if (retomarMoverApos) {
                const pendente = retomarMoverApos;
                retomarMoverApos = null;
                await abrirModalMover(pendente.checklistId, pendente.checklistNome, String(result.pasta.id));
            } else {
                carregarCardsChecklist(1);
            }
        } catch (error) {
            mostrarErro('novaPastaErro', error.message);
        } finally {
            toggleSpinner('confirmNovaPasta', false);
        }
    });

    // Se o usuário fechar o modal de "nova pasta" sem concluir (cancelar/X) enquanto vinha do
    // fluxo de mover, não deixa o pedido pendente "vazando" para a próxima vez que abrir.
    novaPastaModalEl.addEventListener('hidden.bs.modal', function() {
        retomarMoverApos = null;
    });

    // ---- Renomear pasta -------------------------------------------------------------------

    renomearPastaModalEl.addEventListener('show.bs.modal', function(event) {
        const button = event.relatedTarget;
        document.getElementById('renomearPastaId').value = button.getAttribute('data-pasta-id');
        document.getElementById('renomearPastaNome').value = button.getAttribute('data-pasta-nome');
        limparErro('renomearPastaErro');
    });

    document.getElementById('confirmRenomearPasta').addEventListener('click', async function() {
        const id = document.getElementById('renomearPastaId').value;
        const nome = document.getElementById('renomearPastaNome').value.trim();
        if (!nome) {
            mostrarErro('renomearPastaErro', 'Informe o nome da pasta.');
            return;
        }

        toggleSpinner('confirmRenomearPasta', true);
        try {
            const response = await fetch(`/api/checklists/pastas/edit/${id}/`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({ nome }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao renomear pasta');

            renomearPastaModal.hide();
            ToastBottomEnd.fire({ icon: 'success', title: 'Pasta renomeada com sucesso!' });
            carregarCardsChecklist(1);
        } catch (error) {
            mostrarErro('renomearPastaErro', error.message);
        } finally {
            toggleSpinner('confirmRenomearPasta', false);
        }
    });

    // ---- Excluir pasta --------------------------------------------------------------------

    excluirPastaModalEl.addEventListener('show.bs.modal', function(event) {
        const button = event.relatedTarget;
        document.getElementById('excluirPastaId').value = button.getAttribute('data-pasta-id');
        document.getElementById('excluirPastaNome').textContent = button.getAttribute('data-pasta-nome');
        // Desmarcada por padrão a cada abertura: apagar os checklists é uma escolha explícita
        document.getElementById('excluirPastaApagarChecklists').checked = false;
    });

    document.getElementById('confirmExcluirPasta').addEventListener('click', async function() {
        const id = document.getElementById('excluirPastaId').value;
        const apagarChecklists = document.getElementById('excluirPastaApagarChecklists').checked;

        toggleSpinner('confirmExcluirPasta', true);
        try {
            const response = await fetch(`/api/checklists/pastas/delete/${id}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({ apagar_checklists: apagarChecklists }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao excluir pasta');

            excluirPastaModal.hide();
            ToastBottomEnd.fire({ icon: 'success', title: result.message });
            carregarCardsChecklist(1);
        } catch (error) {
            ToastBottomEnd.fire({ icon: 'error', title: error.message });
        } finally {
            toggleSpinner('confirmExcluirPasta', false);
        }
    });

    // ---- Mover checklist para pasta --------------------------------------------------------

    async function abrirModalMover(checklistId, checklistNome, pastaSelecionadaId) {
        document.getElementById('moverChecklistId').value = checklistId;
        document.getElementById('moverChecklistNome').textContent = checklistNome;

        const select = document.getElementById('moverChecklistPastaSelect');
        select.innerHTML = '<option value="">Carregando pastas...</option>';
        select.disabled = true;

        try {
            const response = await fetch('/api/checklists/pastas/');
            if (!response.ok) throw new Error('Erro ao carregar pastas');
            const { pastas } = await response.json();

            select.innerHTML = '<option value="">Sem pasta</option>';
            pastas.forEach(pasta => {
                const option = document.createElement('option');
                option.value = pasta.id;
                option.textContent = pasta.nome;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Erro ao carregar pastas:', error);
            select.innerHTML = '<option value="">Não foi possível carregar as pastas</option>';
        } finally {
            select.disabled = false;
        }

        // Pré-seleciona a pasta atual (todo checklist visível na tela pertence a ela) ou a
        // que acabou de ser criada, quando "Nova Pasta" foi aberta a partir deste modal
        const pastaAtual = obterPastaAtual();
        select.value = pastaSelecionadaId || pastaAtual.id || '';

        moverChecklistModal.show();
    }

    moverChecklistModalEl.addEventListener('show.bs.modal', function(event) {
        const button = event.relatedTarget;
        if (!button) return; // reabertura programática (vinda do fluxo "nova pasta"): já populado
        abrirModalMover(button.getAttribute('data-checklist-id'), button.getAttribute('data-checklist-name'));
    });

    document.getElementById('confirmMoverChecklist').addEventListener('click', async function() {
        const checklistId = document.getElementById('moverChecklistId').value;
        const pastaId = document.getElementById('moverChecklistPastaSelect').value;

        toggleSpinner('confirmMoverChecklist', true);
        try {
            const response = await fetch('/api/checklists/mover/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({ checklist_id: checklistId, pasta_id: pastaId || null }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao mover checklist');

            moverChecklistModal.hide();
            ToastBottomEnd.fire({
                icon: 'success',
                title: result.pasta ? `Movido para "${result.pasta.nome}"` : 'Movido para "Sem pasta"',
            });
            carregarCardsChecklist(1);
        } catch (error) {
            ToastBottomEnd.fire({ icon: 'error', title: error.message });
        } finally {
            toggleSpinner('confirmMoverChecklist', false);
        }
    });

    // ---- Breadcrumb -------------------------------------------------------------------------

    document.getElementById('breadcrumb-raiz').addEventListener('click', function(e) {
        e.preventDefault();
        navegarParaPasta(null, null);
    });
});
