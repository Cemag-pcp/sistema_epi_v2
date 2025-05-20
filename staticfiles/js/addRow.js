import { table, inicializarDataTable } from './datatable.js';

// Função para adicionar nova linha à tabela
export function adicionarLinhaTabela(equipamento) {
    if ($.fn.DataTable.isDataTable('#tabelaEquipamentos')) {
        table.destroy();
    }
    const tabelaEquipamentos = document.getElementById('tabelaEquipamentos').getElementsByTagName('tbody')[0];
    const newRow = document.createElement('tr');
    newRow.setAttribute('data-id', equipamento.id);
    
    newRow.innerHTML = `
        <td>         
            <div class="d-flex justify-content-center align-items-center bg-primary bg-opacity-10 text-primary rounded-circle mx-auto" style="width: 40px; height: 40px; font-weight: bold;">
                ${equipamento.id}
            </div>
        </td>
        <td data-order="${equipamento.nome}" data-codigo="${equipamento.codigo}">
            <div class="d-flex align-items-center">
                <div class="ms-3">
                    <p class="fw-bold mb-1 nome-equipamento">${equipamento.nome}</p>
                    <p class="text-muted mb-0 codigo-equipamento">Código ${equipamento.codigo}</p>
                </div>
            </div>
        </td>
        <td style="align-content:center;" data-order="${equipamento.vida_util_dias}">
            <p class="fw-normal mb-1 vida-util-equipamento">${equipamento.vida_util_dias} dias</p>
        </td>
        <td style="align-content:center;" class="ca-equipamento" data-order="${equipamento.ca || '0'}">
            ${equipamento.ca === null ? 'Não informado' : equipamento.ca}
        </td>
        <td class="status" style="align-content:center;" data-order="${equipamento.ativo}">
            ${equipamento.ativo ? 
                '<span class="badge badge-success rounded-pill d-inline status-approved">Ativo</span>' : 
                '<span class="badge badge-success rounded-pill d-inline status-declined">Desativado</span>'}
        </td>
        <td style="align-content:center;">
            <div class="dropdown">
                <button class="btn btn-link btn-sm btn-rounded" type="button" id="dropdownMenuButton" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="bi bi-three-dots" style="color: black"></i>
                </button>
                <ul class="dropdown-menu" aria-labelledby="dropdownMenuButton">
                    <li>
                        <a data-id="${equipamento.id}"
                            data-nome="${equipamento.nome}"
                            data-codigo="${equipamento.codigo}"
                            data-ca="${equipamento.ca}"
                            data-vida-util-dias="${equipamento.vida_util_dias}"
                            class="dropdown-item g-4 abrirModalEditarEquipamento" style="cursor: pointer;">
                            <i class="bi bi-pencil-square" style="margin-right: 8px;"></i>
                            Editar
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item g-4 abrirModalDesativarEquipamento" 
                            data-nome="${equipamento.nome}" data-id="${equipamento.id}" 
                            style="color: #dc2626; cursor: pointer;">
                            <i class="bi bi-trash abrirModalDesativarEquipamento" style="margin-right: 8px;"></i>
                            Desativar
                        </a>
                    </li>
                </ul>
            </div>
        </td>
    `;
    
    tabelaEquipamentos.appendChild(newRow);

    inicializarDataTable();
}
