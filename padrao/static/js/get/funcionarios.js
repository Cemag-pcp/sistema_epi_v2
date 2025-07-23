import { getCookie } from "../../../../static/js/scripts.js"
import { ToastBottomEnd } from "../../../../static/js/scripts.js";

// Função para carregar funcionários por setor
export async function carregarFuncionariosPorSetor(setorId) {
    try {
        const modalElement = document.getElementById('modal-criar-padrao');
        // Se nenhum setor selecionado, limpa todos os selects
        document.querySelectorAll('.funcionario').forEach(select => {
            select.innerHTML = '<option value="" selected disabled hidden>Carregando...</option>';

            const $select = $(select);

            // Reativa o Select2
            $select.select2({
                dropdownParent: $(modalElement),  // Usa o modal como parent
                width: '100%',
                placeholder: 'Carregando...'  // Melhoria para o placeholder
            });
        });

        const response = await fetch(`/setor/${setorId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            const errorMsg = data.message || 
                           data.detail || 
                           (data.errors ? JSON.stringify(data.errors) : 'Erro desconhecido');
            throw new Error(errorMsg);
        }

        // Gerar opções HTML
        let optionsHTML = '<option value="" selected disabled hidden>Selecione um funcionário</option>';
        
        if (data.funcionarios && data.funcionarios.length) {
            data.funcionarios.forEach(func => {
                optionsHTML += `<option value="${func.id}">${func.matricula} - ${func.nome}</option>`;
            });
        } else {
            optionsHTML += '<option value="" disabled>Nenhum funcionário encontrado</option>';
        }

        // Atualizar TODOS os selects de funcionário (incluindo clones)
        document.querySelectorAll('.funcionario').forEach(select => {
            const $select = $(select);

            if ($select.hasClass('select2-hidden-accessible')) {
                $select.select2('destroy');
            }

            // Atualiza as opções
            select.innerHTML = optionsHTML;

            // Reativa o Select2
            $select.select2({
                dropdownParent: $(modalElement),  // Usa o modal como parent
                width: '100%',
                placeholder: 'Selecione um funcionário'  // Melhoria para o placeholder
            });
        });


    } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
        // Mostrar feedback visual para o usuário
        ToastBottomEnd.fire({
            icon: 'error',
            title: 'Erro ao carregar funcionários'
        });
    }
}