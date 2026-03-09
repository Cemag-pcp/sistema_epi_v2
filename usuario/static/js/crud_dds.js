import { getCookie, ToastBottomEnd } from "/static/js/scripts.js";

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
const ddsParticipantesInput = document.getElementById("ddsParticipantes");
const ddsModalLabel = document.getElementById("ddsModalLabel");
const saveDDSBtn = document.getElementById("saveDDSBtn");
const saveDDSButtonText = document.getElementById("saveDDSButtonText");
const saveDDSSpinner = document.getElementById("saveDDSSpinner");

let ddsRegistros = [];
let participantes = [];
let ddsTable = null;

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

function formatDate(dateString) {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
}

function renderParticipantes(participantesLista) {
    if (!participantesLista.length) {
        return "--";
    }

    return participantesLista
        .map((participante) => `${participante.matricula} - ${participante.nome}`)
        .join("<br>");
}

function initializeSelect2() {
    $(ddsParticipantesInput).select2({
        dropdownParent: $(ddsModalElement),
        width: "100%",
        placeholder: "Selecione os participantes",
        theme: "bootstrap-5"
    });
}

function populateParticipantesOptions() {
    ddsParticipantesInput.innerHTML = participantes
        .map(
            (participante) =>
                `<option value="${participante.id}">${participante.matricula} - ${participante.nome}</option>`
        )
        .join("");

    $(ddsParticipantesInput).trigger("change");
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
            {
                data: "participantes",
                render: function (value) {
                    return renderParticipantes(value);
                }
            },
            { data: "updated_at" },
            {
                data: null,
                orderable: false,
                searchable: false,
                render: function (_, __, row) {
                    return `
                        <button class="btn btn-sm btn-white edit-btn" data-id="${row.id}">
                            <i class="bi bi-pencil-square me-1"></i>Editar
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
            { targets: 4, width: "30%" }
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
    $(ddsParticipantesInput).val(null).trigger("change");
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
    $(ddsParticipantesInput)
        .val(dds.participantes.map((participante) => String(participante.id)))
        .trigger("change");

    ddsModalLabel.textContent = "Editar DDS";
    ddsModal.show();
}

function getPayload() {
    const participantesSelecionados = $(ddsParticipantesInput).val() || [];
    return {
        titulo: ddsTituloInput.value.trim(),
        data: ddsDataInput.value,
        horario: ddsHorarioInput.value,
        participantes: participantesSelecionados.map((value) => Number(value))
    };
}

addDDSBtn.addEventListener("click", openCreateModal);

saveDDSBtn.addEventListener("click", async () => {
    if (!ddsForm.checkValidity()) {
        ddsForm.reportValidity();
        return;
    }

    const payload = getPayload();
    if (!payload.participantes.length) {
        showAlert("Selecione pelo menos um participante", "error");
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

document.getElementById("ddsTable").addEventListener("click", (event) => {
    const editButton = event.target.closest(".edit-btn");
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
        initializeSelect2();
        await fetchParticipantes();
        await fetchDDS();
    } catch (error) {
        console.error(error);
        showAlert(error.message || "Erro ao inicializar a tela de DDS", "error");
    }
});
