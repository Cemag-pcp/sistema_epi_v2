document.addEventListener("DOMContentLoaded", function () {
    const addBtn = document.getElementById("add-clone");
    const removeBtn = document.getElementById("remove-last");
    const cloneContainer = document.getElementById("clone-container");

    addBtn.addEventListener("click", function () {
        const original = document.querySelector(".clone-form");
        const clone = original.cloneNode(true);

        // Limpa os valores dos inputs
        const inputs = clone.querySelectorAll("input, textarea, select");
        inputs.forEach(input => {
            if (input.tagName === "SELECT") {
                input.selectedIndex = 0;
            } else {
                input.value = "";
            }
        });

        cloneContainer.appendChild(clone);
    });

    removeBtn.addEventListener("click", function () {
        const clones = cloneContainer.querySelectorAll(".clone-form");
        if (clones.length > 1) {
            cloneContainer.removeChild(clones[clones.length - 1]);
        } else {
            alert("Não é possível remover o primeiro formulário.");
        }
    });
});
