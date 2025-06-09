import { getCookie } from "../../../../static/js/scripts.js"
import { carregarFuncionariosPorSetor} from "./funcionarios.js"

document.addEventListener('DOMContentLoaded', async () =>{

    try {

        const selectSetores = document.getElementById('padrao_setor');

        const setorId = selectSetores.dataset.setorId;
        
        // Monta a URL com ou sem o parâmetro setor_id
        let url = '/api_setores/';
        if (setorId) {
            url += `?setor_id=${setorId}`;
        }
    
        const response = await fetch(`/api_setores/?setor_id=${setorId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
    
        const setores = await response.json();
        if (!response.ok) {  
            // Extrai a mensagem de erro detalhada do backend
            const errorMsg = setores.message || 
                            setores.detail || 
                            (setores.errors ? JSON.stringify(setores.errors) : 'Erro desconhecido');
            throw new Error(errorMsg);
        }
        if (setores && setores.length) {
            let optionsHTML = `
                <option value="" selected disabled hidden>Selecione um setor</option>
            `;

            setores.forEach(element => {
                optionsHTML += `<option value="${element.id}">${element.nome}</option>`;
            });

            selectSetores.innerHTML = optionsHTML; // Substitui todo o conteúdo
        } else {
            throw new Error(setores.message || 'Erro ao atualizar equipamento');
        }
    } catch (error){
        console.error(error)
    }
})

document.getElementById('padrao_setor').addEventListener('change', function() {
    const setorId = this.value;
    carregarFuncionariosPorSetor(setorId);
});