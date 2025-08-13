import { ToastBottomEnd } from "./scripts.js";

// Configuração para múltiplos containers de clone
export const formConfigurations = [
    {
        addBtnId: "add-clone-1",
        containerId: "clone-container-1",
        formClass: "clone-form-1"
    },
    {
        addBtnId: "add-clone-2",
        containerId: "clone-container-2",
        formClass: "clone-form-2"
    }
];

// Função para inicializar cada conjunto de formulários clonáveis
export function setupCloneForms(config) {
    const addBtn = document.getElementById(config.addBtnId);
    const cloneContainer = document.getElementById(config.containerId);

    if (!addBtn || !cloneContainer) return;

    addBtn.addEventListener("click", function () {
        const originals = cloneContainer.querySelectorAll(`.${config.formClass}`);
        const lastOriginal = originals[originals.length - 1];

        $(lastOriginal)
        .find('select.select2')
        .each(function () {
            if ($(this).hasClass("select2-hidden-accessible")) {
                $(this).select2('destroy');
            }
        });

        const clone = lastOriginal.cloneNode(true);

        // Atualiza o número da solicitação
        const requestText = clone.querySelector(".request");
        if (requestText) {
            const cloneNumber = originals.length + 1;
            requestText.textContent = `${cloneNumber}ª Solicitação`;
        }

        // Limpa os valores dos inputs
        const inputs = clone.querySelectorAll("input, textarea, select");
        inputs.forEach(input => {
            if (input.tagName === "SELECT") {
                input.selectedIndex = 0;
            } else if (input.type !== "submit") {
                if(!input.classList.contains('requestName')){
                    input.value = "";
                }
            }
        });

        // Atualiza os nomes dos campos para evitar conflitos
        const fields = clone.querySelectorAll("[name]");
        fields.forEach(field => {
            const originalName = field.getAttribute("name");
            field.setAttribute("name", `${originalName}_clone_${Date.now()}`);
        });

        // Adiciona botão de remoção ao clone
        const removeBtn = clone.querySelector(".btn-outline-danger");
        if (removeBtn) {
            removeBtn.addEventListener("click", function() {
                if (cloneContainer.querySelectorAll(`.${config.formClass}`).length > 1) {
                    clone.remove();
                    // Atualiza os números das solicitações restantes
                    updateRequestNumbers(cloneContainer, config.formClass);
                } else {
                    ToastBottomEnd.fire({
                        icon: 'warning',
                        title: 'Você não pode remover a última solicitação!'
                    });
                }
            });
        }

        cloneContainer.appendChild(clone);

        $(lastOriginal).find('select.select2').each(function () {
            const $select = $(this);
            const $modal = $select.closest('#modal-criar-padrao');
            
            $select.select2({
                dropdownParent: $modal.length ? $modal : $(document.body),
                width: '100%'
            });
        });
        
        $(clone).find('select.select2').each(function () {
            const $select = $(this);
            const $modal = $select.closest('.modal');
            
            $select.select2({
                dropdownParent: $modal.length ? $modal : $(document.body),
                width: '100%'
            });
        });
    });

    // Configura os botões de remoção dos formulários existentes
    const existingRemoveBtns = cloneContainer.querySelectorAll(".remove-specific-request");
    existingRemoveBtns.forEach(btn => {
        btn.addEventListener("click", function() {
            const form = btn.closest(`.${config.formClass}`);
            if (cloneContainer.querySelectorAll(`.${config.formClass}`).length > 1) {
                form.remove();
                // Atualiza os números das solicitações restantes
                updateRequestNumbers(cloneContainer, config.formClass);
            } else {
                ToastBottomEnd.fire({
                    icon: 'warning',
                    title: 'Não é possível remover o primeiro formulário.'
                });
            }
        });
    });
}

// Função para atualizar os números das solicitações
export function updateRequestNumbers(container, formClass) {
    const forms = container.querySelectorAll(`.${formClass}`);
    forms.forEach((form, index) => {
        const requestText = form.querySelector(".request");
        if (requestText) {
            requestText.textContent = `${index + 1}ª Solicitação`;
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    // Inicializa todos os conjuntos de formulários
    formConfigurations.forEach(setupCloneForms);
});