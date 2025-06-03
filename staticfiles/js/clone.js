document.addEventListener("DOMContentLoaded", function () {
    // Configuração para múltiplos containers de clone
    const formConfigurations = [
        {
            addBtnId: "add-clone-1",
            removeBtnId: "remove-last-1",
            containerId: "clone-container-1",
            formClass: "clone-form-1"
        },
        {
            addBtnId: "add-clone-2",
            removeBtnId: "remove-last-2",
            containerId: "clone-container-2",
            formClass: "clone-form-2"
        }
    ];

    // Função para inicializar cada conjunto de formulários clonáveis
    function setupCloneForms(config) {
        const addBtn = document.getElementById(config.addBtnId);
        const removeBtn = document.getElementById(config.removeBtnId);
        const cloneContainer = document.getElementById(config.containerId);

        if (!addBtn || !removeBtn || !cloneContainer) return;

        addBtn.addEventListener("click", function () {
            const originals = cloneContainer.querySelectorAll(`.${config.formClass}`);
            const lastOriginal = originals[originals.length - 1];
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

            cloneContainer.appendChild(clone);
        });

        removeBtn.addEventListener("click", function () {
            const clones = cloneContainer.querySelectorAll(`.${config.formClass}`);
            if (clones.length > 1) {
                cloneContainer.removeChild(clones[clones.length - 1]);
            } else {
                alert("Não é possível remover o primeiro formulário.");
            }
        });
    }

    // Inicializa todos os conjuntos de formulários
    formConfigurations.forEach(setupCloneForms);
});