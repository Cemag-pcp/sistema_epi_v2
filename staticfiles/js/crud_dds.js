import { getCookie, ToastBottomEnd } from "/static/js/scripts.js";
import { resizeCanvas } from "/static/js/assinatura/resize-canva.js";

const loadingSpinner = document.getElementById("loadingSpinner");
const searchInput = document.getElementById("searchInput");
const addDDSBtn = document.getElementById("addDDSBtn");

const ddsModalElement = document.getElementById("ddsModal");
const ddsModal = new bootstrap.Modal(ddsModalElement);
const ddsForm = document.getElementById("ddsForm");
const ddsIdInput = document.getElementById("ddsId");
const ddsTituloInput = document.getElementById("ddsTitulo");
const ddsDataInput = document.getElementById("ddsData");
const ddsHorarioInput = document.getElementById("ddsHorario");
const ddsResponsavelInput = document.getElementById("ddsResponsavel");
const ddsParticipantesInput = document.getElementById("ddsParticipantes");
const ddsModalLabel = document.getElementById("ddsModalLabel");
const saveDDSBtn = document.getElementById("saveDDSBtn");
const saveDDSButtonText = document.getElementById("saveDDSButtonText");
const saveDDSSpinner = document.getElementById("saveDDSSpinner");
const ddsSignatureModalElement = document.getElementById("ddsSignatureModal");
const ddsSignatureModal = new bootstrap.Modal(ddsSignatureModalElement);
const ddsSignatureModalLabel = document.getElementById("ddsSignatureModalLabel");
const ddsSignatureParticipantLabel = document.getElementById("ddsSignatureParticipantLabel");
const ddsSignatureCanvas = document.getElementById("ddsSignatureCanvas");
const saveDDSignatureBtn = document.getElementById("saveDDSignatureBtn");
const saveDDSignatureSpinner = document.getElementById("saveDDSignatureSpinner");
const saveDDSignatureText = document.getElementById("saveDDSignatureText");
const clearDDSignatureBtn = document.getElementById("clearDDSignatureBtn");
const closeDDSignatureModalBtn = document.getElementById("closeDDSignatureModal");

let ddsRegistros = [];
let participantes = [];
let ddsTable = null;
const PARTICIPANTES_PREVIEW_LIMIT = 2;
let assinaturaPadDDS = null;
let participanteAssinaturaAtualId = null;
let previousParticipantesSelecionados = [];
let assinaturasPendentesFila = [];
let assinaturasParticipantes = new Map();
let assinaturasExistentesIds = new Set();

function showAlert(message, type = "success") {
    ToastBottomEnd.fire({
        icon: type,
        title: message
    });
}

function setSaveLoading(isLoading) {
    saveDDSButtonText.classList.toggle("d-none", isLoading);
    saveDDSSpinner.classList.toggle("d-none", !isLoading);
    saveDDSBtn.disabled = isLoading;
}

function setSignatureLoading(isLoading) {
    saveDDSignatureSpinner.classList.toggle("d-none", !isLoading);
    saveDDSignatureText.textContent = isLoading ? "Salvando..." : "Salvar assinatura";
    saveDDSignatureBtn.disabled = isLoading;
}

function formatDate(dateString) {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
}

function renderParticipantes(participantesLista) {
    if (!participantesLista.length) {
        return "--";
    }

    const participantesFormatados = participantesLista.map(
        (participante) => `${participante.matricula} - ${participante.nome}`
    );

    if (participantesFormatados.length <= PARTICIPANTES_PREVIEW_LIMIT) {
        return participantesFormatados.join("<br>");
    }

    const participantesVisiveis = participantesFormatados.slice(0, PARTICIPANTES_PREVIEW_LIMIT).join("<br>");
    const participantesOcultos = participantesFormatados
        .slice(PARTICIPANTES_PREVIEW_LIMIT)
        .join("<br>");

    return `
        <div class="dds-participantes">
            <div>${participantesVisiveis}</div>
            <div class="dds-participantes-extra d-none">${participantesOcultos}</div>
            <button type="button" class="btn btn-link btn-sm p-0 mt-1 dds-toggle-participantes">
                Ver mais
            </button>
        </div>
    `;
}

function getParticipantesText(participantesLista) {
    if (!participantesLista.length) {
        return "--";
    }

    return participantesLista
        .map((participante) => `${participante.matricula} - ${participante.nome}`)
        .join(" | ");
}

function initializeSelect2() {
    $(ddsResponsavelInput).select2({
        dropdownParent: $(ddsModalElement),
        width: "100%",
        placeholder: "Selecione o responsável",
        theme: "bootstrap-5"
    });

    $(ddsParticipantesInput).select2({
        dropdownParent: $(ddsModalElement),
        width: "100%",
        placeholder: "Selecione os participantes",
        theme: "bootstrap-5"
    });
}

function syncResponsavelOptions(selectedIds = []) {
    const responsavelAtual = ddsResponsavelInput.value;
    const participantesSelecionados = participantes.filter((participante) =>
        selectedIds.includes(String(participante.id))
    );

    ddsResponsavelInput.innerHTML = `
        <option value=""></option>
        ${participantesSelecionados
            .map(
                (participante) =>
                    `<option value="${participante.id}">${participante.matricula} - ${participante.nome}</option>`
            )
            .join("")}
    `;

    const podeManterResponsavel = participantesSelecionados.some(
        (participante) => String(participante.id) === responsavelAtual
    );

    $(ddsResponsavelInput)
        .val(podeManterResponsavel ? responsavelAtual : null)
        .trigger("change");
}

function populateParticipantesOptions() {
    ddsParticipantesInput.innerHTML = participantes
        .map(
            (participante) =>
                `<option value="${participante.id}">${participante.matricula} - ${participante.nome}</option>`
        )
        .join("");

    syncResponsavelOptions([]);
    $(ddsParticipantesInput).trigger("change");
}

function initializeSignaturePad() {
    assinaturaPadDDS = new SignaturePad(ddsSignatureCanvas);
    assinaturaPadDDS.minWidth = 1;
    assinaturaPadDDS.maxWidth = 3;
    assinaturaPadDDS.penColor = "black";
    resizeCanvas(ddsSignatureCanvas, assinaturaPadDDS);
}

function getParticipanteById(participanteId) {
    return participantes.find((participante) => participante.id === Number(participanteId)) || null;
}

function openSignatureModalForParticipante(participanteId) {
    const participante = getParticipanteById(participanteId);
    const participanteSelecionado = ($(ddsParticipantesInput).val() || []).includes(String(participanteId));
    if (!participante || !participanteSelecionado) {
        processNextSignatureQueue();
        return;
    }

    participanteAssinaturaAtualId = Number(participanteId);
    ddsSignatureModalLabel.textContent = `Assinatura - ${participante.nome}`;
    ddsSignatureParticipantLabel.textContent = `${participante.matricula} - ${participante.nome} deve assinar para confirmar a participação na DDS.`;
    assinaturaPadDDS.clear();
    ddsSignatureModal.show();
}

function processNextSignatureQueue() {
    if (!assinaturasPendentesFila.length) {
        return;
    }

    const proximoParticipanteId = assinaturasPendentesFila.shift();
    openSignatureModalForParticipante(proximoParticipanteId);
}

function removeParticipanteSelection(participanteId) {
    const selecionados = ($(ddsParticipantesInput).val() || []).filter((value) => value !== String(participanteId));
    previousParticipantesSelecionados = selecionados;
    assinaturasParticipantes.delete(Number(participanteId));
    assinaturasExistentesIds.delete(Number(participanteId));
    $(ddsParticipantesInput).val(selecionados).trigger("change");
    syncResponsavelOptions(selecionados);
}

function handleParticipantesSelectionChange() {
    const participantesSelecionados = $(ddsParticipantesInput).val() || [];
    syncResponsavelOptions(participantesSelecionados);

    const adicionados = participantesSelecionados.filter(
        (participanteId) =>
            !previousParticipantesSelecionados.includes(participanteId) &&
            !assinaturasParticipantes.has(Number(participanteId)) &&
            !assinaturasExistentesIds.has(Number(participanteId))
    );

    const removidos = previousParticipantesSelecionados.filter(
        (participanteId) => !participantesSelecionados.includes(participanteId)
    );

    removidos.forEach((participanteId) => {
        assinaturasParticipantes.delete(Number(participanteId));
        assinaturasExistentesIds.delete(Number(participanteId));
    });

    assinaturasPendentesFila.push(
        ...adicionados.filter((participanteId) => !assinaturasPendentesFila.includes(Number(participanteId)))
            .map((participanteId) => Number(participanteId))
    );

    previousParticipantesSelecionados = [...participantesSelecionados];

    if (!ddsSignatureModalElement.classList.contains("show")) {
        processNextSignatureQueue();
    }
}

function initializeDataTable(data) {
    if (ddsTable) {
        ddsTable.destroy();
    }

    ddsTable = $("#ddsTable").DataTable({
        data,
        columns: [
            { data: "id" },
            { data: "titulo" },
            {
                data: "data",
                render: function (value) {
                    return formatDate(value);
                }
            },
            { data: "horario" },
            { data: "responsavel_label" },
            {
                data: "participantes",
                render: function (value, type) {
                    if (type === "display") {
                        return renderParticipantes(value);
                    }

                    return getParticipantesText(value);
                }
            },
            { data: "updated_at" },
            {
                data: null,
                orderable: false,
                searchable: false,
                render: function (_, __, row) {
                    return `
                        <button class="btn btn-sm btn-outline-secondary export-pdf-btn me-2" data-id="${row.id}" title="Exportar PDF" aria-label="Exportar PDF">
                            <i class="bi bi-file-earmark-pdf"></i>
                        </button>
                        <button class="btn btn-sm btn-white edit-btn me-2" data-id="${row.id}" title="Editar DDS" aria-label="Editar DDS">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${row.id}" title="Excluir DDS" aria-label="Excluir DDS">
                            <i class="bi bi-trash"></i>
                        </button>
                    `;
                }
            }
        ],
        language: {
            url: "//cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json"
        },
        responsive: true,
        order: [[0, "desc"]],
        columnDefs: [
            { targets: 5, width: "30%" }
        ]
    });
}

async function fetchParticipantes() {
    const response = await fetch("/api_dds_participantes/");
    if (!response.ok) {
        throw new Error("Erro ao carregar participantes");
    }

    participantes = await response.json();
    populateParticipantesOptions();
}

async function fetchDDS() {
    try {
        loadingSpinner.classList.remove("d-none");
        const response = await fetch("/api_dds/");
        if (!response.ok) {
            throw new Error("Erro ao carregar historico de DDS");
        }

        ddsRegistros = await response.json();
        initializeDataTable(ddsRegistros);
    } catch (error) {
        console.error(error);
        showAlert(error.message || "Falha ao carregar DDS", "error");
    } finally {
        loadingSpinner.classList.add("d-none");
    }
}

function resetForm() {
    ddsForm.reset();
    ddsIdInput.value = "";
    previousParticipantesSelecionados = [];
    assinaturasPendentesFila = [];
    assinaturasParticipantes = new Map();
    assinaturasExistentesIds = new Set();
    $(ddsResponsavelInput).val(null).trigger("change");
    $(ddsParticipantesInput).val(null).trigger("change");
    syncResponsavelOptions([]);
}

function openCreateModal() {
    resetForm();
    ddsModalLabel.textContent = "Nova DDS";
    ddsModal.show();
}

function openEditModal(dds) {
    ddsIdInput.value = dds.id;
    ddsTituloInput.value = dds.titulo;
    ddsDataInput.value = dds.data;
    ddsHorarioInput.value = dds.horario;
    assinaturasParticipantes = new Map();
    assinaturasExistentesIds = new Set(dds.assinaturas_ids || []);
    previousParticipantesSelecionados = dds.participantes.map((participante) => String(participante.id));
    $(ddsParticipantesInput)
        .val(previousParticipantesSelecionados)
        .trigger("change");
    syncResponsavelOptions(previousParticipantesSelecionados);
    $(ddsResponsavelInput).val(dds.responsavel ? String(dds.responsavel.id) : null).trigger("change");

    ddsModalLabel.textContent = "Editar DDS";
    ddsModal.show();
}

function getPayload() {
    const participantesSelecionados = $(ddsParticipantesInput).val() || [];
    return {
        titulo: ddsTituloInput.value.trim(),
        data: ddsDataInput.value,
        horario: ddsHorarioInput.value,
        responsavel: Number(ddsResponsavelInput.value),
        participantes: participantesSelecionados.map((value) => Number(value)),
        assinaturas: Array.from(assinaturasParticipantes.entries()).map(([funcionarioId, signature]) => ({
            funcionario_id: funcionarioId,
            signature
        }))
    };
}

addDDSBtn.addEventListener("click", openCreateModal);

saveDDSBtn.addEventListener("click", async () => {
    if (!ddsForm.checkValidity()) {
        ddsForm.reportValidity();
        return;
    }

    const payload = getPayload();
    if (!payload.responsavel) {
        showAlert("Selecione um responsavel", "error");
        return;
    }

    if (!payload.participantes.length) {
        showAlert("Selecione pelo menos um participante", "error");
        return;
    }

    const participantesSemAssinatura = payload.participantes.filter(
        (participanteId) =>
            !assinaturasParticipantes.has(participanteId) &&
            !assinaturasExistentesIds.has(participanteId)
    );
    if (participantesSemAssinatura.length) {
        showAlert("Todos os participantes devem assinar a DDS", "error");
        processNextSignatureQueue();
        return;
    }

    try {
        setSaveLoading(true);

        const ddsId = ddsIdInput.value;
        const isEditing = Boolean(ddsId);
        const response = await fetch(isEditing ? `/dds/${ddsId}/` : "/api_dds/", {
            method: isEditing ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken")
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Falha ao salvar DDS");
        }

        await fetchDDS();
        ddsModal.hide();
        showAlert(isEditing ? "DDS atualizada com sucesso!" : "DDS cadastrada com sucesso!");
    } catch (error) {
        console.error(error);
        showAlert(error.message || "Erro ao salvar DDS", "error");
    } finally {
        setSaveLoading(false);
    }
});

$(ddsParticipantesInput).on("change", handleParticipantesSelectionChange);

ddsSignatureModalElement.addEventListener("shown.bs.modal", function () {
    resizeCanvas(ddsSignatureCanvas, assinaturaPadDDS);
});

ddsSignatureModalElement.addEventListener("hidden.bs.modal", function () {
    if (assinaturaPadDDS) {
        assinaturaPadDDS.clear();
    }

    if (participanteAssinaturaAtualId) {
        const participanteAindaSelecionado = (($(ddsParticipantesInput).val() || []).includes(String(participanteAssinaturaAtualId)));
        const temAssinatura = assinaturasParticipantes.has(participanteAssinaturaAtualId) || assinaturasExistentesIds.has(participanteAssinaturaAtualId);
        if (participanteAindaSelecionado && !temAssinatura) {
            removeParticipanteSelection(participanteAssinaturaAtualId);
            showAlert("Participante removido por falta de assinatura", "error");
        }
    }

    participanteAssinaturaAtualId = null;
    processNextSignatureQueue();
});

saveDDSignatureBtn.addEventListener("click", function () {
    if (!participanteAssinaturaAtualId) {
        return;
    }

    if (assinaturaPadDDS.isEmpty()) {
        showAlert("Preencha a assinatura antes de salvar", "error");
        return;
    }

    setSignatureLoading(true);
    const signature = assinaturaPadDDS.toDataURL();
    assinaturasParticipantes.set(participanteAssinaturaAtualId, signature);
    assinaturasExistentesIds.add(participanteAssinaturaAtualId);
    setSignatureLoading(false);
    ddsSignatureModal.hide();
});

clearDDSignatureBtn.addEventListener("click", function () {
    if (assinaturaPadDDS) {
        assinaturaPadDDS.clear();
    }
});

closeDDSignatureModalBtn.addEventListener("click", function () {
    ddsSignatureModal.hide();
});

document.getElementById("ddsTable").addEventListener("click", async (event) => {
    const toggleParticipantesButton = event.target.closest(".dds-toggle-participantes");
    if (toggleParticipantesButton) {
        const participantesContainer = toggleParticipantesButton.closest(".dds-participantes");
        const participantesExtra = participantesContainer?.querySelector(".dds-participantes-extra");
        if (!participantesExtra) {
            return;
        }

        const isExpanded = !participantesExtra.classList.contains("d-none");
        participantesExtra.classList.toggle("d-none", isExpanded);
        toggleParticipantesButton.textContent = isExpanded ? "Ver mais" : "Ver menos";
        return;
    }

    const editButton = event.target.closest(".edit-btn");
    const deleteButton = event.target.closest(".delete-btn");
    const exportPdfButton = event.target.closest(".export-pdf-btn");
    if (exportPdfButton) {
        window.open(`/dds/${exportPdfButton.dataset.id}/exportar-pdf/`, "_blank");
        return;
    }

    if (deleteButton) {
        const ddsId = Number(deleteButton.dataset.id);
        const result = await Swal.fire({
            title: "Cuidado",
            text: "Esta ação excluirá a DDS e as assinaturas vinculadas. Deseja continuar?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sim, excluir",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#dc3545"
        });

        if (!result.isConfirmed) {
            return;
        }

        try {
            const response = await fetch(`/dds/${ddsId}/`, {
                method: "DELETE",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken")
                }
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Falha ao excluir DDS");
            }

            await fetchDDS();
            showAlert(data.message || "DDS removida com sucesso!");
        } catch (error) {
            console.error(error);
            showAlert(error.message || "Erro ao excluir DDS", "error");
        }
        return;
    }

    if (!editButton) {
        return;
    }

    const ddsId = Number(editButton.dataset.id);
    const dds = ddsRegistros.find((item) => item.id === ddsId);
    if (!dds) {
        showAlert("DDS nao encontrada", "error");
        return;
    }

    openEditModal(dds);
});

searchInput.addEventListener("keyup", function () {
    if (ddsTable) {
        ddsTable.search(this.value).draw();
    }
});

$(document).ready(async function () {
    try {
        initializeSignaturePad();
        initializeSelect2();
        await fetchParticipantes();
        await fetchDDS();
    } catch (error) {
        console.error(error);
        showAlert(error.message || "Erro ao inicializar a tela de DDS", "error");
    }
});
