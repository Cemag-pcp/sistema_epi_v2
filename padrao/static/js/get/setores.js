import { getCookie } from "../../../../static/js/scripts.js"
import { carregarFuncionariosPorSetor } from "./funcionarios.js"

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const selectSetores = document.getElementById('padrao_setor');
        const modalElement = document.getElementById('modal-criar-padrao');
        const setorId = selectSetores.dataset.setorId;
        
        // Monta a URL com ou sem o parâmetro setor_id
        let url = '/api_setores/';
        if (setorId) {
            url += `?setor_id=${setorId}`;
        }
    
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            }
        });
    
        const setores = await response.json();
        
        if (!response.ok) {  
            const errorMsg = setores.message || 
                            setores.detail || 
                            (setores.errors ? JSON.stringify(setores.errors) : 'Erro desconhecido');
            throw new Error(errorMsg);
        }
        
        // Preenche as opções do select
        let optionsHTML = `<option value="" selected disabled hidden>Selecione um setor</option>`;
        
        if (setores && setores.length) {
            setores.forEach(element => {
                optionsHTML += `<option value="${element.id}">${element.nome}</option>`;
            });
        }
        
        selectSetores.innerHTML = optionsHTML;
        
        // Inicializa o Select2 APÓS preencher as opções
        $(selectSetores).select2({
            dropdownParent: $(modalElement),  // Usa o modal como parent
            width: '100%',
            placeholder: 'Selecione um setor'  // Melhoria para o placeholder
        });
        
        // Evento de change
        $(selectSetores).on('change', function() {
            carregarFuncionariosPorSetor(this.value);
        });
        
    } catch (error) {
        console.error('Erro ao carregar setores:', error);
    }
});