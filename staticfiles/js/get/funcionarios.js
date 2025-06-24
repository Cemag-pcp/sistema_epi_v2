import { getCookie } from "../../../../static/js/scripts.js"


// Função para carregar funcionários por setor
export async function carregarFuncionariosPorSetor(setorId) {
    try {
        // Se nenhum setor selecionado, limpa todos os selects
        document.querySelectorAll('.funcionario').forEach(select => {
            select.innerHTML = '<option value="" selected disabled hidden>Carregando...</option>';
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
            select.innerHTML = optionsHTML;
        });

    } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
        // Mostrar feedback visual para o usuário
        Toast.fire({
            icon: 'error',
            title: 'Erro ao carregar funcionários'
        });
    }
}