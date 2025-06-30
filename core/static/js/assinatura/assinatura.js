import { resizeCanvas } from "./resize-canva.js";
import { solicitacoesTable } from "../get_solicitacoes_home.js";

document.addEventListener("DOMContentLoaded", function () {
    let assinatura;
    const formAssinatura = document.getElementById("form-assinatura");
    const campoQualidade = document.getElementById("campo-tabela-qualidade");
    const radiosDevolucao = formAssinatura.querySelectorAll('input[name="is_devolucao"]');
    
    // Função para controlar a exibição e obrigatoriedade dos campos de qualidade
    function toggleCamposQualidade() {
        const devolucaoSelecionada = formAssinatura.querySelector('input[name="is_devolucao"]:checked');
        
        if (devolucaoSelecionada && devolucaoSelecionada.value === "Sim") {
            campoQualidade.style.display = "block";
            const allQualityRadios = formAssinatura.querySelectorAll('input[name^="qualidade-"]');
            allQualityRadios.forEach(radio => {
                radio.required = true;
            });
        } else {
            campoQualidade.style.display = "none";
            const allQualityRadios = formAssinatura.querySelectorAll('input[name^="qualidade-"]');
            allQualityRadios.forEach(radio => {
                radio.required = false;
                radio.checked = false;
            });
        }
    }

    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('button-assinatura')) {
            const modalAssinatura = document.getElementById("modal-assinatura");
            const assinaturaCanva = document.getElementById("signature-canvas");
            const modalTitle = document.getElementById("modal-assinatura-title");
            
            // Obtém a linha da tabela onde o botão foi clicado
            const row = event.target.closest('tr');
            const rowData = solicitacoesTable.row(row).data();
            
            // Preenche o título do modal com o nome do funcionário
            modalTitle.textContent = `Assinatura - ${rowData.funcionario_nome}`;
            
            // Elementos que queremos mostrar/ocultar
            const devolucaoSection = document.querySelector('.devolver-item');
            const funcionarioText = devolucaoSection.querySelector('p:first-of-type');
            const tabelaQualidade = document.getElementById('tabela-qualidade-equipamento');
            
            // Filtra apenas os itens com motivo "substituicao"
            const itensSubstituicao = rowData.itens.filter(item => 
                item.motivo && item.motivo.toLowerCase() === 'substituicao'
            );
            
            // Limpa completamente a tabela antes de preencher
            const tbody = tabelaQualidade.querySelector('tbody');
            tbody.innerHTML = '';
            
            if (itensSubstituicao.length === 0) {
                // Oculta a seção de devolução e qualidade
                devolucaoSection.style.display = 'none';
                tabelaQualidade.style.display = 'none';
                campoQualidade.style.display = 'none';
                
                // Remove qualquer mensagem anterior
                const existingMessage = tbody.querySelector('tr.text-center');
                if (existingMessage) {
                    tbody.removeChild(existingMessage);
                }
            } else {
                // Mostra a seção de devolução e qualidade
                devolucaoSection.style.display = 'block';
                tabelaQualidade.style.display = 'table';
                
                // Preenche o texto do funcionário no modal
                funcionarioText.textContent = `O funcionário ${rowData.funcionario_nome} devolverá o item substituído agora?`;
                
                // Marca "Não" como selecionado
                document.getElementById('nao').checked = true;
                
                // Preenche a tabela de equipamentos
                itensSubstituicao.forEach((item, index) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.equipamento_nome} (Qtd: ${item.quantidade})</td>
                        <td>
                            <div class="form-check form-check-inline">
                                <input class="form-check-input" type="radio" id="bom-${index}" name="qualidade-${index}" value="Bom" required>
                                <label class="form-check-label" for="bom-${index}">Bom</label>
                            </div>
                            <div class="form-check form-check-inline">
                                <input class="form-check-input" type="radio" id="ruim-${index}" name="qualidade-${index}" value="Ruim">
                                <label class="form-check-label" for="ruim-${index}">Ruim</label>
                            </div>
                            <div class="form-check form-check-inline">
                                <input class="form-check-input" type="radio" id="descarte-${index}" name="qualidade-${index}" value="Descarte">
                                <label class="form-check-label" for="descarte-${index}">Descarte</label>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
                    
                // Atualiza os listeners para os radio buttons de devolução
                radiosDevolucao.forEach(radio => {
                    radio.addEventListener('change', toggleCamposQualidade);
                });

            }
                
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
            
            // Inicializa o estado dos campos
            toggleCamposQualidade();
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