import { resizeCanvas } from "./resize-canva.js";
import { solicitacoesTable } from "../get_solicitacoes_home.js";
import { getCookie } from "../../../../static/js/scripts.js";

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
            const idDadosSolicitacao = event.target.getAttribute('data-solicitacao');
            const modalAssinatura = document.getElementById("modal-assinatura");
            const assinaturaCanva = document.getElementById("signature-canvas");
            const modalTitle = document.getElementById("modal-assinatura-title");

            modalAssinatura.setAttribute('data-solicitacao', idDadosSolicitacao);
            
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
                    tr.id = `equipamento-${index}`;
                    tr.setAttribute('data-equipamento-id', item.equipamento_id);

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
            const form = event.target;
            const submitButton = form.querySelector('.verificar-assinatura');
            const spinner = submitButton.querySelector('.spinner-border');
            const buttonText = submitButton.querySelector('span[role="status"]');
            
            // Mostra o spinner e desabilita o botão
            spinner.style.display = 'inline-block';
            buttonText.textContent = 'Salvando...';
            submitButton.disabled = true;

            // Obtém o ID da solicitação do botão de assinatura
            const modalAssinatura = document.getElementById('modal-assinatura');
            const solicitacaoId = modalAssinatura ? modalAssinatura.getAttribute('data-solicitacao') : null;
            
            if (!solicitacaoId) {

                spinner.style.display = 'none';
                buttonText.textContent = 'Salvar';
                submitButton.disabled = false;
                return;
            }

            // Obtém os dados do formulário
            const isDevolucao = form.querySelector('input[name="is_devolucao"]:checked')?.value;
            const signaturePad = document.getElementById('signature-canvas');
            const signature = signaturePad.toDataURL(); // Converte a assinatura para base64

            // Coleta os dados de qualidade dos equipamentos
            const qualidadeEquipamentos = [];
            document.querySelectorAll('tr[id^="equipamento-"]').forEach(row => {
                const equipamentoId = row.getAttribute('data-equipamento-id');
                const index = row.id.replace('equipamento-', '');
                const qualidade = row.querySelector('input[name="qualidade-' + index + '"]:checked')?.value;
                
                if (qualidade) {
                    qualidadeEquipamentos.push({
                        equipamento_id: equipamentoId,
                        qualidade: qualidade
                    });
                }
            });

            // Prepara os dados para envio
            const formData = {
                is_devolucao: isDevolucao,
                signature: signature,
                equipamentos: qualidadeEquipamentos,
                solicitacao_id: solicitacaoId
            };

            // Faz a requisição POST
            fetch(`/core/assinatura/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken') // Função para pegar o token CSRF
                },
                body: JSON.stringify(formData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro ao enviar assinatura');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Fecha o modal e recarrega a tabela
                    const modal = bootstrap.Modal.getInstance(document.getElementById('modal-assinatura'));
                    modal.hide();
                    solicitacoesTable.ajax.reload();
                } else {
                    throw new Error(data.message || 'Erro ao processar assinatura');
                }
            })
            .catch(error => {
                console.error('Erro:', error);
            })
            .finally(() => {
                // Restaura o botão
                spinner.style.display = 'none';
                buttonText.textContent = 'Salvar';
                submitButton.disabled = false;
            });
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