import { getCookie, ToastBottomEnd } from "/static/js/scripts.js";

const loadingSpinner = document.getElementById("loadingSpinner");
const searchInput = document.getElementById("searchInput");
const addCargoBtn = document.getElementById("addCargoBtn");

const cargoModalElement = document.getElementById("cargoModal");
const cargoModal = new bootstrap.Modal(cargoModalElement);
const cargoForm = document.getElementById("cargoForm");
const cargoIdInput = document.getElementById("cargoId");
const cargoNomeInput = document.getElementById("cargoNome");
const cargoModalLabel = document.getElementById("cargoModalLabel");
const saveCargoBtn = document.getElementById("saveCargoBtn");
const saveButtonText = document.getElementById("saveButtonText");
const saveSpinner = document.getElementById("saveSpinner");

const deleteCargoModalElement = document.getElementById("deleteCargoModal");
const deleteCargoModal = new bootstrap.Modal(deleteCargoModalElement);
const deleteCargoName = document.getElementById("deleteCargoName");
const confirmDeleteCargoBtn = document.getElementById("confirmDeleteCargoBtn");
const deleteButtonText = document.getElementById("deleteButtonText");
const deleteSpinner = document.getElementById("deleteSpinner");

let cargos = [];
let cargoTable = null;

function showAlert(message, type = "success") {
    ToastBottomEnd.fire({
        icon: type,
        title: message
    });
}

function initializeDataTable(data) {
    if (cargoTable) {
        cargoTable.destroy();
    }

    cargoTable = $("#cargoTable").DataTable({
        data,
        columns: [
            { data: "id" },
            { data: "nome" },
            {
                data: null,
                orderable: false,
                searchable: false,
                render: function (_, __, row) {
                    return `
                        <div class="dropdown">
                            <button class="btn btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li>
                                    <a class="dropdown-item edit-btn" href="#" data-id="${row.id}">
                                        <i class="bi bi-pencil-square me-2"></i>Editar
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item delete-btn" href="#" data-id="${row.id}" style="color: #dc2626;">
                                        <i class="bi bi-trash me-2"></i>Excluir
                                    </a>
                                </li>
                            </ul>
                        </div>
                    `;
                }
            }
        ],
        language: {
            url: "//cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json"
        },
        responsive: true,
        order: [[1, "asc"]]
    });
}

async function fetchCargos() {
    try {
        loadingSpinner.classList.remove("d-none");
        const response = await fetch("/api_cargos/");
        if (!response.ok) {
            throw new Error("Erro ao carregar cargos");
        }

        cargos = await response.json();
        initializeDataTable(cargos);
    } catch (error) {
        console.error(error);
        showAlert(error.message || "Falha ao carregar cargos", "error");
    } finally {
        loadingSpinner.classList.add("d-none");
    }
}

function resetCargoForm() {
    cargoForm.reset();
    cargoIdInput.value = "";
}

function setSaveLoading(isLoading) {
    saveButtonText.classList.toggle("d-none", isLoading);
    saveSpinner.classList.toggle("d-none", !isLoading);
    saveCargoBtn.disabled = isLoading;
}

function setDeleteLoading(isLoading) {
    deleteButtonText.classList.toggle("d-none", isLoading);
    deleteSpinner.classList.toggle("d-none", !isLoading);
    confirmDeleteCargoBtn.disabled = isLoading;
}

addCargoBtn.addEventListener("click", () => {
    resetCargoForm();
    cargoModalLabel.textContent = "Novo Cargo";
    cargoModal.show();
});

saveCargoBtn.addEventListener("click", async () => {
    if (!cargoForm.checkValidity()) {
        cargoForm.reportValidity();
        return;
    }

    try {
        setSaveLoading(true);

        const cargoId = cargoIdInput.value;
        const payload = { nome: cargoNomeInput.value.trim() };
        const isEditing = Boolean(cargoId);
        const url = isEditing ? `/cargos/${cargoId}/` : "/cargos/";
        const method = isEditing ? "PUT" : "POST";

        const response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken")
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Falha ao salvar cargo");
        }

        await fetchCargos();
        cargoModal.hide();
        showAlert(isEditing ? "Cargo atualizado com sucesso!" : "Cargo criado com sucesso!");
    } catch (error) {
        console.error(error);
        showAlert(error.message || "Erro ao salvar cargo", "error");
    } finally {
        setSaveLoading(false);
    }
});

document.getElementById("cargoTable").addEventListener("click", (event) => {
    const editButton = event.target.closest(".edit-btn");
    const deleteButton = event.target.closest(".delete-btn");

    if (editButton) {
        event.preventDefault();
        const cargoId = Number(editButton.dataset.id);
        const cargo = cargos.find((item) => item.id === cargoId);

        if (!cargo) {
            showAlert("Cargo nao encontrado", "error");
            return;
        }

        cargoIdInput.value = cargo.id;
        cargoNomeInput.value = cargo.nome;
        cargoModalLabel.textContent = "Editar Cargo";
        cargoModal.show();
    }

    if (deleteButton) {
        event.preventDefault();
        const cargoId = Number(deleteButton.dataset.id);
        const cargo = cargos.find((item) => item.id === cargoId);

        if (!cargo) {
            showAlert("Cargo nao encontrado", "error");
            return;
        }

        confirmDeleteCargoBtn.dataset.id = cargo.id;
        deleteCargoName.textContent = cargo.nome;
        deleteCargoModal.show();
    }
});

confirmDeleteCargoBtn.addEventListener("click", async () => {
    const cargoId = confirmDeleteCargoBtn.dataset.id;

    try {
        setDeleteLoading(true);

        const response = await fetch(`/cargos/${cargoId}/`, {
            method: "DELETE",
            headers: {
                "X-CSRFToken": getCookie("csrftoken")
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Falha ao excluir cargo");
        }

        await fetchCargos();
        deleteCargoModal.hide();
        showAlert("Cargo removido com sucesso!");
    } catch (error) {
        console.error(error);
        showAlert(error.message || "Erro ao excluir cargo", "error");
    } finally {
        setDeleteLoading(false);
    }
});

searchInput.addEventListener("keyup", function () {
    if (cargoTable) {
        cargoTable.search(this.value).draw();
    }
});

$(document).ready(function () {
    fetchCargos();
});
