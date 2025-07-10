import { getCookie } from "../../../../static/js/scripts.js";
import { ToastBottomEnd } from "../../../../static/js/scripts.js";

document.addEventListener('DOMContentLoaded', async () =>{
     try {
        const modalElement = document.getElementById('modal-criar-padrao');
        // Se nenhum setor selecionado, limpa todos os selects
        document.querySelectorAll('.equipamento').forEach(select => {
            select.innerHTML = '<option value="" selected disabled hidden>Carregando...</option>';
            const $select = $(select);

            // Reativa o Select2
            $select.select2({
                dropdownParent: $(modalElement),  // Usa o modal como parent
                width: '100%',
                placeholder: 'Carregando...'  // Melhoria para o placeholder
            });
        });

        document.querySelectorAll('.motivo').forEach(select => {
            select.innerHTML = '<option value="" selected disabled hidden>Carregando...</option>';
        });

        const response = await fetch(`/padroes/equipamentos/`, {
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
        let optionsHTML = '<option value="" selected disabled hidden>Selecione um equipamento</option>';
        
        console.log(data);

        if (data.equipamentos && data.equipamentos.length) {
            data.equipamentos.forEach(equip => {
                optionsHTML += `<option value="${equip.id}">${equip.codigo} - ${equip.nome}</option>`;
            });
        } else {
            optionsHTML += '<option value="" disabled>Nenhum equipamento encontrado</option>';
        }

        let optionsHTMLMotivo = '<option value="" selected disabled hidden>Selecione um Motivo</option>';

        if (data.motivos && data.motivos.length) {
            data.motivos.forEach(mot => {
                optionsHTMLMotivo += `<option value="${mot.id}">${mot.nome}</option>`;
            });
        } else {
            optionsHTMLMotivo += '<option value="" disabled>Nenhum Motivo encontrado</option>';
        }

        // Atualizar TODOS os selects de funcionário (incluindo clones)
        document.querySelectorAll('.equipamento').forEach(select => {
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
                placeholder: 'Selecione um equipamento'  // Melhoria para o placeholder
            });
        });

        document.querySelectorAll('.motivo').forEach(select => {
            select.innerHTML = optionsHTMLMotivo;
        });

    } catch (error) {
        console.error('Erro ao carregar equipamento:', error);
        // Mostrar feedback visual para o usuário
        ToastBottomEnd.fire({
            icon: 'error',
            title: 'Erro ao carregar equipamento'
        });
    }
})