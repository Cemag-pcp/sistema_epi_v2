import { resizeCanvas } from "./resize-canva.js";
import { solicitacoesTable } from "../get_solicitacoes_home.js";
import { getCookie, ToastBottomEnd } from "../../../../static/js/scripts.js";
import { getOldestDuplicateItems, 
        updateConditionCell, 
        updateQuantidadeDevolvidaCell, 
        updateSelectionUI,
       } from "/static/js/utils.js";

// Variaveis para armazenar dados de devolução
let selectedItems = [];
let itensFiltrados;

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
            return true;
        } else {
            campoQualidade.style.display = "none";
            return false;
        }
    }

    document.addEventListener('hidden.bs.modal', function () {
        console.log('Modal fechado');
        selectedItems = []; // Reseta a lista de itens selecionados
    })

    document.addEventListener('click', async function (event) {
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

            console.log(itensSubstituicao);

            // Limpa completamente a tabela antes de preencher
            const tbody = tabelaQualidade.querySelector('tbody');
            tbody.innerHTML = '';

            // Verificar itens ativos do funcionário
            let itensAtivos = [];
            const botaoAssinaturaPendente = document.querySelector(`button.button-assinatura[data-solicitacao="${idDadosSolicitacao}"]`);
            
            // Desabilita todos os botões com assinatura pendente para evitar cliques indesejados
            const botoesAssinaturaPendente = document.querySelectorAll('.button-assinatura');
            botoesAssinaturaPendente.forEach(button => {
                button.disabled = true;
            });
            botaoAssinaturaPendente.textContent = 'Carregando...';

            try {
                itensAtivos = await itensAtivosFuncionario(rowData.funcionario_id);
                console.log('Itens ativos do funcionário:', itensAtivos);

                // Verifica se há itens de substituição E se há itens ativos correspondentes
                const hasSubstitutionItems = itensSubstituicao.length > 0;
                const hasActiveItemsForSubstitution = itensSubstituicao.some(subItem => 
                    itensAtivos.some(activeItem => activeItem.equipamento_id === subItem.equipamento_id)
                );

                if (!hasSubstitutionItems || !hasActiveItemsForSubstitution) {
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

                    // Filtra apenas os itens ativos que correspondem aos itens de substituição
                    itensFiltrados = itensAtivos.filter(activeItem => 
                        itensSubstituicao.some(subItem => subItem.equipamento_id === activeItem.equipamento_id)
                    );
                    console.log('Itens filtrados:', itensFiltrados);

                    // Verificando itens mais antigos
                    const oldestDuplicateIds = getOldestDuplicateItems(itensFiltrados);

                    // Preenche a tabela de equipamentos
                    itensFiltrados.forEach((item, index) => {
                        const isOldest = oldestDuplicateIds.has(item.id);
                        const tr = document.createElement('tr');
                        tr.id = `equipamento-${index}`;
                        tr.setAttribute('data-equipamento-id', item.equipamento_id);
                        tr.className = isOldest ? 'oldest-item' : '';

                        tr.innerHTML = `
                            <td>
                                <input class="form-check-input item-checkbox" type="checkbox" value="${item.id}" name="itemDevolver" data-item-id="${item.id}">
                            </td>
                            <td class="${isOldest ? 'text-danger fw-medium' : 'fw-medium'}">
                                ${item.equipamento_nome}
                                ${isOldest ? '<span class="badge bg-danger ms-2" style="font-size: 0.7rem;">Mais antigo</span>' : ''}
                            </td>
                            <td>
                                <i class="bi bi-calendar3 me-1 text-muted"></i>
                                ${item.data_recebimento}
                            </td>
                            <td class="text-center">
                                ${item.quantidade_disponivel}
                            </td>
                            <td class="text-center quantidade-devolvida-cell" data-item-id="${item.id}">
                                <span class="text-muted">Selecione para alterar</span>
                            </td>
                            <td class="condition-cell" data-item-id="${item.id}">
                                <span class="text-muted">Selecione para ver</span>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });

                    // Atualiza os listeners para os radio buttons de devolução
                    radiosDevolucao.forEach(radio => {
                        radio.addEventListener('change', toggleCamposQualidade);
                    });

                    // Add event listeners to checkboxes
                    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
                        console.log(checkbox);
                        checkbox.addEventListener('change', handleItemToggle);
                    });
                }
            } catch (error) {
                console.error('Erro ao carregar itens ativos:', error);
                // Em caso de erro, oculta as seções
                devolucaoSection.style.display = 'none';
                tabelaQualidade.style.display = 'none';
                campoQualidade.style.display = 'none';
            } finally {
                // Habilita os botões novamente
                botaoAssinaturaPendente.disabled = false;
                botaoAssinaturaPendente.textContent = 'Assinatura Pendente';
                botoesAssinaturaPendente.forEach(button => {
                    button.disabled = false;
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
            modalAssinatura.addEventListener('shown.bs.modal', function () {
                resizeCanvas(assinaturaCanva, assinatura);
            });

            // Inicializa o estado dos campos
            toggleCamposQualidade();
        }
    });

    document.addEventListener('submit', function (event) {
        event.preventDefault();
        
        if (event.target.id === 'form-assinatura') {
            //Verifica se o checkbox de devolução está marcado
            if (toggleCamposQualidade()) {
                console.log(selectedItems);
                if (selectedItems.length == 0) {
                    // Se não houver nenhum item selecionado, exibe uma mensagem de erro
                    ToastBottomEnd.fire({
                        icon: 'error',
                        title: 'Por favor, selecione pelo menos um item para devolução.'
                    });
                    return;
                }
                // Se passar pra essa parte, quer dizer que algum item foi selecionado
            }

            let qtdDevolvidaInvalida = false;
            let erroText = '';

            for (const itemId of selectedItems) {
                const items = itensFiltrados;

                const item = items.find(i => i.id === itemId);
                const cell = document.querySelector(`[data-item-id="${itemId}"].quantidade-devolvida-cell`);
                let inputValue = cell.querySelector('input').value;

                if (parseInt(inputValue) <= 0) {
                    erroText = `Quantidade devolvida para o EPI ${item.equipamento_codigo}-${item.equipamento_nome} inválida.`;
                    qtdDevolvidaInvalida = true;
                    break;
                }

                if (parseInt(inputValue) > parseInt(item.quantidade_disponivel)) {
                    erroText = `Quantidade devolvida para o EPI ${item.equipamento_codigo}-${item.equipamento_nome} é maior que a disponível.`;
                    qtdDevolvidaInvalida = true;
                    break;
                }

            }
            //Verificar se a flag foi modificada
            if (qtdDevolvidaInvalida) {
                ToastBottomEnd.fire({
                    icon: 'error',
                    title: erroText
                });
                return;
            }


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
            
            if (assinatura.isEmpty()) {
                ToastBottomEnd.fire({
                    icon: 'error',
                    title: 'Preencha a assinatura antes de enviar.'
                });
                spinner.style.display = 'none';
                buttonText.textContent = 'Salvar';
                submitButton.disabled = false;
                return;
            }

            let itemQtdsDevolvidas = {};
            let itemCondicoes = {};
            //Pegar os dados necessários para registrar a devolução de todos os selecionados
            selectedItems.forEach(itemId => {
                const cell = document.querySelector(`[data-item-id="${itemId}"].quantidade-devolvida-cell`);
                const input = cell.querySelector('input');
                let quantidadeDevolvida = parseInt(input.value);
                itemQtdsDevolvidas[itemId] = quantidadeDevolvida;

                const conditionCell = document.querySelector(`[data-item-id="${itemId}"].condition-cell`);
                const conditionSelect = conditionCell.querySelector('.condition-select');
                if (conditionSelect) {
                    itemCondicoes[itemId] = conditionSelect.value;
                } else {
                    itemCondicoes[itemId] = 'bom'; // Default condition if not selected
                }

            })

            const itensEnvio = selectedItems.map(itemId => {
                const item = itensFiltrados.find(i => i.id === itemId);

                if (!item) return null; // Skip if item not found
                return {
                    ...item,
                    quantidade_devolvida: itemQtdsDevolvidas[itemId],
                    condicao: itemCondicoes[itemId]
                };
            })

            // Prepara os dados para envio
            const formData = {
                is_devolucao: isDevolucao,
                signature: signature,
                equipamentos: itensEnvio,
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
                        solicitacoesTable.ajax.reload(null, false);
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
    window.addEventListener('resize', function () {
        const canvas = document.getElementById("signature-canvas");
        if (canvas && assinatura) {
            resizeCanvas(canvas, assinatura);
        }
    });
});

function handleItemToggle(event) {
    const itemId = parseInt(event.target.value);
    const isChecked = event.target.checked;


    if (isChecked) {
        if (!selectedItems.includes(itemId)) {
            selectedItems.push(itemId);
        }
    } else {
        selectedItems = selectedItems.filter(id => id !== itemId);
    }

    console.log(selectedItems);

    updateQuantidadeDevolvidaCell(itemId, isChecked, itensFiltrados);
    updateConditionCell(itemId, isChecked, itensFiltrados);
    updateSelectionUI(itensFiltrados, selectedItems);

}

async function itensAtivosFuncionario(funcionarioId) {
    try {
        const response = await fetch(`/api_itens_ativos/${funcionarioId}/`);
        if (!response.ok) {
            throw new Error('Não encontrou itens ativos do funcionário');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        return [];
    }
}