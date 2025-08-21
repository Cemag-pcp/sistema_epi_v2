import { getCookie, toggleSpinner, ToastBottomEnd } from "../../../static/js/scripts.js";

document.addEventListener('DOMContentLoaded', function() {
    // Handler para exclusão de checklist
    document.getElementById('confirmChecklistDeleteBtn').addEventListener('click', function() {
        const pathParts = window.location.pathname.split('/');
        const checklistId = pathParts[pathParts.length - 2];

        // Mostrar spinner
        toggleSpinner('confirmChecklistDeleteBtn', true);

        fetch(`/api/checklists/delete/${checklistId}/`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro HTTP! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            ToastBottomEnd.fire({
                icon: 'success',
                title: 'Checklist excluído com sucesso!'
            })
            window.location.href = '/checklists/';
        })
        .catch(error => {
            console.error('Erro ao excluir checklist:', error);
            ToastBottomEnd.fire({
                icon: 'error',
                title: 'Erro ao excluir checklist. Por favor, tente novamente.'
            })
            toggleSpinner('confirmChecklistDeleteBtn', false);
        });
    });
});