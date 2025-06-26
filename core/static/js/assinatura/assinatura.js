import { resizeCanvas } from "./resize-canva.js";

document.addEventListener("DOMContentLoaded", function () {
    let assinatura;
    const formAssinatura = document.getElementById("form-assinatura");
    const campoQualidade = document.getElementById("campo-tabela-qualidade");
    const radiosDevolucao = formAssinatura.querySelectorAll('input[name="is_devolucao"]');
    const radiosQualidade = formAssinatura.querySelectorAll('input[name="qualidade"]');

    // Função para controlar a exibição e obrigatoriedade dos campos de qualidade
    function toggleCamposQualidade() {
        const devolucaoSelecionada = formAssinatura.querySelector('input[name="is_devolucao"]:checked');
        
        if (devolucaoSelecionada && devolucaoSelecionada.value === "Sim") {
            campoQualidade.style.display = "block";
            radiosQualidade.forEach(radio => {
                radio.required = true;
            });
        } else {
            campoQualidade.style.display = "none";
            radiosQualidade.forEach(radio => {
                radio.required = false;
                radio.checked = false;
            });
        }
    }

    // Adiciona listeners para os radio buttons de devolução
    radiosDevolucao.forEach(radio => {
        radio.addEventListener('change', toggleCamposQualidade);
    });

    // Inicializa o estado dos campos
    toggleCamposQualidade();

    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('button-assinatura')) {
            const idSolicitacao = event.target.getAttribute('data-id');
            const modalAssinatura = document.getElementById("modal-assinatura");
            const assinaturaCanva = document.getElementById("signature-canvas");

            // Inicializa ou reinicializa a assinatura
            assinatura = new SignaturePad(assinaturaCanva);
            
            // Configurações opcionais
            assinatura.minWidth = 1;
            assinatura.maxWidth = 3;
            assinatura.penColor = "black";

            // Redimensiona quando o modal é mostrado
            resizeCanvas(assinaturaCanva, assinatura);

            const modal = new bootstrap.Modal(modalAssinatura);
            modal.show();

            // Redimensiona novamente quando a animação do modal terminar
            modalAssinatura.addEventListener('shown.bs.modal', function() {
                resizeCanvas(assinaturaCanva, assinatura);
            });
        }
    });

    document.addEventListener('submit', function (event) {
        event.preventDefault();

        if (event.target.id === 'form-assinatura') {
            console.log("FORMULÁRIO");
            // Aqui você pode adicionar a lógica de envio do formulário
        }
    });

    document.getElementById("limpar-assinatura").addEventListener('click', function () {
        if (assinatura) {
            assinatura.clear();
        }
    });

    // Redimensiona quando a janela muda de tamanho
    window.addEventListener('resize', function() {
        const canvas = document.getElementById("signature-canvas");
        if (canvas && assinatura) {
            resizeCanvas(canvas, assinatura);
        }
    });
});