// API Configuration - Using your specific endpoint
const API_CONFIG = {
  baseURL: "/core", // Your Django app base URL
  endpoints: {
    historico: "/api_historico/", // Your specific endpoint
  },
  timeout: 30000, // 30 seconds timeout
}

// Global variables
let currentData = []
let currentPage = 1
let pageSize = 25
let sortColumn = "data_atualizacao"
let sortDirection = "desc"
let isLoading = false
let lastRequestTime = 0
let totalCount = 0
let totalPages = 0

// Action type translations
const actionTypeTranslations = {
  request_created: "Solicitação Criada",
  item_delivered: "Item Entregue",
  item_returned: "Item Devolvido",
  signature_added: "Assinatura Adicionada",
  request_canceled: "Solicitação Cancelada",
  status_updated: "Status Atualizado",
}

// Status translations
const statusTranslations = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  entregue: "Entregue",
  devolvido: "Devolvido",
  cancelado: "Cancelado",
  Devolvido: "Devolvido", // Handle your API status format
}

// Bootstrap Modal library
const bootstrap = window.bootstrap

// Function to handle API errors
function handleAPIError(message) {
  console.error("API Error:", message)
  showErrorState(message)

  // Clear current data on error
  currentData = []
  renderTable()
  updateStatistics()
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners()
  loadData()
})

function initializeEventListeners() {
  // Search input with longer debounce for server requests
  document.getElementById("searchIcon").addEventListener("click", debounce(applyFilters, 10))

  // Filter selects
  document.getElementById("actionTypeFilter").addEventListener("change", applyFilters)
  // document.getElementById("statusFilter").addEventListener("change", applyFilters)
  document.getElementById("startDate").addEventListener("change", applyFilters)
  document.getElementById("endDate").addEventListener("change", applyFilters)

  // Page size
  document.getElementById("pageSize").addEventListener("change", function () {
    pageSize = Number.parseInt(this.value)
    currentPage = 1
    loadData()
  })

  // Sortable columns
  document.querySelectorAll(".sortable").forEach((header) => {
    header.addEventListener("click", function () {
      const column = this.dataset.sort
      if (sortColumn === column) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc"
      } else {
        sortColumn = column
        sortDirection = "asc"
      }
      currentPage = 1
      loadData()
      updateSortIcons()
    })
  })
}

function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// SIMPLIFIED: Since Django now returns pre-transformed historical entries, we just need to format them
function transformApiDataToHistoricalLog(apiData) {
  const historicalData = []

  apiData.forEach((item) => {
    // Each item from API is already a historical entry
    item.itens.forEach((equipItem) => {
      historicalData.push({
        id: item.id,
        timestamp: item.data_atualizacao,
        action_type: item.action_type, // Now provided by Django
        user: getUserFromItem(item),
        user_type: getUserTypeFromAction(item.action_type),
        equipment: equipItem.equipamento_nome,
        quantity: equipItem.quantidade,
        reason: getReasonFromAction(item.action_type, equipItem.motivo),
        observations: getObservationsFromAction(item.action_type, item.observacoes_gerais, equipItem.estado_item),
        status: item.status.toLowerCase(),
        request_id: `${item.solicitacao_id}`,
        estado_item: equipItem.estado_item,
        departamento: "N/A",
        funcionario_matricula: item.funcionario_matricula || "N/A",
        funcionario_nome: item.funcionario_nome || "N/A",
        solicitante_nome: item.solicitante_nome,
        solicitante_matricula: item.solicitante_matricula,
        responsavel_recebimento: item.responsavel_recebimento_nome,
        responsavel_recebimento_id: item.responsavel_recebimento_id,
        equipamento_codigo: equipItem.equipamento_codigo,
        original_solicitacao_id: item.solicitacao_id,
      })
    })
  })

  return historicalData
}

function getUserFromItem(item) {
  // switch (item.action_type) {
  //   case "request_created":
  //     return item.funcionario_nome
  //   case "status_updated":
  //     return item.solicitante_nome
  //   case "item_delivered":
  //   case "signature_added":
  //     return item.solicitante_nome || item.funcionario_nome
  //   case "item_returned":
  //     return item.responsavel_recebimento_nome || "Sistema"
  //   case "request_canceled":
  //     return item.solicitante_nome || item.funcionario_nome
  //   default:
  //     return item.funcionario_nome
  // }
    return item.funcionario_nome;
}

function getUserTypeFromAction(actionType) {
  switch (actionType) {
    case "request_created":
    case "item_delivered":
    case "signature_added":
    case "item_returned":
    case "request_canceled":
      return "funcionario"
    case "status_updated":
      return "usuario"
    default:
      return "funcionario"
  }
}

function getReasonFromAction(actionType, originalMotivo) {
  switch (actionType) {
    case "request_created":
      return originalMotivo || "Solicitação de EPI"
    case "status_updated":
      return "Aprovação da solicitação"
    case "item_delivered":
      return "Entrega conforme solicitação"
    case "signature_added":
      return "Confirmação de recebimento"
    case "item_returned":
      return "Devolução de EPI"
    case "request_canceled":
      return "Cancelamento da solicitação"
    default:
      return originalMotivo || "Ação do sistema"
  }
}

function getObservationsFromAction(actionType, observacoesGerais, estadoItem) {
  switch (actionType) {
    case "request_created":
      return observacoesGerais || "Solicitação criada"
    case "status_updated":
      return "Solicitação aprovada"
    case "item_delivered":
      return "Item entregue ao funcionário"
    case "signature_added":
      return "Assinatura digital confirmada"
    case "item_returned":
      return `Item devolvido - Estado: ${estadoItem || "N/A"}`
    case "request_canceled":
      return "Solicitação cancelada"
    default:
      return observacoesGerais || "Ação realizada"
  }
}

async function loadData() {
  if (isLoading) return

  isLoading = true
  showLoading(true)
  hideErrorState()

  const requestTime = Date.now()
  lastRequestTime = requestTime

  try {
    const params = buildAPIParams()
    const result = await makeAPIRequest(API_CONFIG.endpoints.historico, params)

    // Check if this is still the latest request
    if (requestTime !== lastRequestTime) {
      return // Ignore outdated requests
    }

    if (result.success) {
      const apiData = result.data.dados_solicitados || []
      totalCount = result.data.total_itens || result.data.count || 0
      totalPages = result.data.total_pages || Math.ceil(totalCount / pageSize)
      currentPage = result.data.current_page || currentPage

      // Debug info
      // if (result.data.debug_info) {
      //   console.log("🔍 Debug Info:", result.data.debug_info)
      // }

      // console.log(
      //   `📊 API Response: ${apiData.length} items, Total Historical Entries: ${totalCount}, Page: ${currentPage}/${totalPages}`,
      // )

      // Transform API data to historical log format
      const transformedData = transformApiDataToHistoricalLog(apiData)
      currentData = transformedData

      isLoading = false
      renderTable()
      renderPagination()
      updateStatistics()
      updateRecordCount()

      // console.log(`✅ Transformed to ${transformedData.length} historical entries for display`)
    } else {
      handleAPIError(result.error)
    }
  } catch (error) {
    if (requestTime === lastRequestTime) {
      handleAPIError(error.message)
    }
  } finally {
    if (requestTime === lastRequestTime) {
      isLoading = false
      showLoading(false)
    }
  }
}

function applyFilters() {
  currentPage = 1
  loadData()
}

function renderTable() {
  const tbody = document.getElementById("logTableBody")
  const emptyState = document.getElementById("emptyState")

  // Show/hide empty state
  if (currentData.length === 0 && !isLoading) {
    emptyState.classList.remove("d-none")
    tbody.innerHTML = ""
    return
  } else {
    emptyState.classList.add("d-none")
  }

  if (isLoading) {
    // Show loading skeleton
    tbody.innerHTML = Array(pageSize)
      .fill(0)
      .map(
        () => `
      <tr>
        <td><div class="loading-row" style="height: 20px; border-radius: 4px;"></div></td>
        <td><div class="loading-row" style="height: 20px; border-radius: 4px;"></div></td>
        <td><div class="loading-row" style="height: 20px; border-radius: 4px;"></div></td>
        <td><div class="loading-row" style="height: 20px; border-radius: 4px;"></div></td>
        <td><div class="loading-row" style="height: 20px; border-radius: 4px;"></div></td>
        <td><div class="loading-row" style="height: 20px; border-radius: 4px;"></div></td>
        <td><div class="loading-row" style="height: 20px; border-radius: 4px;"></div></td>
        <td><div class="loading-row" style="height: 20px; border-radius: 4px;"></div></td>
      </tr>
    `,
      )
      .join("")
    return
  }

  tbody.innerHTML = currentData
    .map(
      (item) => `
        <tr>
            <td>
                <span class="fw-bold">
                    ${item.request_id}
                </span>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    <span class="timeline-dot ${getActionColor(item.action_type)}"></span>
                    <div>
                        <div class="fw-bold">${formatDate(item.timestamp)}</div>
                        <small class="text-muted">${formatTime(item.timestamp)}</small>
                    </div>
                </div>
            </td>
            <td>
                <span class="action-badge action-${item.action_type}">
                    ${actionTypeTranslations[item.action_type]}
                </span>
            </td>
            <td>
                <div class="user-info">
                    <div class="user-avatar">
                        ${getUserInitials(item.user)}
                    </div>
                    <div>
                        <div class="fw-bold">${item.user}</div>
                        <small class="text-muted text-capitalize">${item.user_type}</small>
                        ${item.funcionario_matricula ? `<small class="text-muted d-block">Mat: ${item.funcionario_matricula}</small>` : ""}
                    </div>
                </div>
            </td>
            <td>
                <div class="equipment-info">
                    <div class="equipment-icon">
                        <i class="fas fa-hard-hat"></i>
                    </div>
                    <div>
                        <div class="fw-bold">${item.equipment}</div>
                        <small class="text-muted">${item.equipamento_codigo || item.departamento}</small>
                    </div>
                </div>
            </td>
            <td>
                <span class="quantity-badge">${item.quantity}</span>
            </td>
            <td>
                <div class="text-truncate" style="max-width: 200px;" title="${item.observations}">
                    ${item.observations}
                </div>
                ${item.reason ? `<small class="fw-bold d-block ${getActionColor(item.action_type)}">${item.reason}</small>` : ""}
            </td>
            <td>
                <button class="btn btn-outline-primary detail-btn" onclick="showDetails('${item.id}')">
                    <i class="fas fa-eye"></i>
                    Ver
                </button>
            </td>
        </tr>
    `,
    )
    .join("")
}

function renderPagination() {
  const pagination = document.getElementById("pagination")

  if (totalPages <= 1) {
    pagination.innerHTML = ""
    return
  }

  let paginationHTML = ""

  // Previous button
  paginationHTML += `
        <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </a>
        </li>
    `

  // Page numbers
  const startPage = Math.max(1, currentPage - 2)
  const endPage = Math.min(totalPages, currentPage + 2)

  if (startPage > 1) {
    paginationHTML += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(1)">1</a></li>`
    if (startPage > 2) {
      paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `
            <li class="page-item ${i === currentPage ? "active" : ""}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>
        `
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`
    }
    paginationHTML += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${totalPages})">${totalPages}</a></li>`
  }

  // Next button
  paginationHTML += `
        <li class="page-item ${currentPage >= totalPages ? "disabled" : ""}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </a>
        </li>
    `

  pagination.innerHTML = paginationHTML
}

function changePage(page) {
  if (page >= 1 && page <= totalPages && page !== currentPage) {
    currentPage = page
    loadData()
  }
}

function updateRecordCount() {
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalCount)
  document.getElementById("showingCount").textContent = `${startIndex}-${endIndex}`
  document.getElementById("totalCount").textContent = totalCount
}

function updateStatistics() {
  const stats = {
    total: currentData.length,
    created: currentData.filter((item) => item.action_type === "request_created").length,
    delivered: currentData.filter((item) => item.action_type === "item_delivered").length,
    returned: currentData.filter((item) => item.action_type === "item_returned").length,
    signatures: currentData.filter((item) => item.action_type === "signature_added").length,
    canceled: currentData.filter((item) => item.action_type === "request_canceled").length,
  }

  document.getElementById("totalRequests").textContent = stats.total
  document.getElementById("createdRequests").textContent = stats.created
  document.getElementById("deliveredItems").textContent = stats.delivered
  document.getElementById("returnedItems").textContent = stats.returned
  document.getElementById("signatures").textContent = stats.signatures
  document.getElementById("canceledRequests").textContent = stats.canceled
}

function updateSortIcons() {
  document.querySelectorAll(".sortable").forEach((header) => {
    const icon = header.querySelector(".sort-icon")
    header.classList.remove("sorted")

    if (header.dataset.sort === sortColumn) {
      header.classList.add("sorted")
      icon.className = `fas fa-sort-${sortDirection === "asc" ? "up" : "down"} sort-icon`
    } else {
      icon.className = "fas fa-sort sort-icon"
    }
  })
}

function getActionColor(actionType) {
  const colors = {
    request_created: "success",
    item_delivered: "info",
    item_returned: "warning",
    signature_added: "purple",
    request_canceled: "danger",
    status_updated: "dark",
  }
  return colors[actionType] || "dark"
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("pt-BR")
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getUserInitials(name) {
  if (!name) return "??"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase()
}

function showDetails(itemId) {
  const item = currentData.find((i) => i.id === itemId)
  if (!item) return

  const modalBody = document.getElementById("modalBody")
  const isDevolucao = item.action_type === "item_returned"

  modalBody.innerHTML = `
        <div class="detail-section">
            <h6><i class="fas fa-info-circle me-2"></i>Informações Gerais</h6>
            <div class="row">
                <div class="col-sm-3">ID da Solicitação:</div>
                <div class="col-sm-9"><strong>${item.request_id}</strong></div>
            </div>
            <div class="row">
                <div class="col-sm-3">Tipo de Ação:</div>
                <div class="col-sm-9">
                    <span class="action-badge action-${item.action_type} ${getActionColor(item.action_type)}">
                      ${actionTypeTranslations[item.action_type]}
                    </span>
                </div>
            </div>
            <div class="row">
                <div class="col-sm-3">Data/Hora:</div>
                <div class="col-sm-9">${formatDate(item.timestamp)} às ${formatTime(item.timestamp)}</div>
            </div>
            <div class="row">
                <div class="col-sm-3">Status Atual:</div>
                <div class="col-sm-9">
                    <span class="status-badge status-${item.status}">
                        ${statusTranslations[item.status] || item.status}
                    </span>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <h6><i class="fas fa-user me-2"></i>Usuário Responsável</h6>
            <div class="row">
                <div class="col-sm-3">Nome:</div>
                <div class="col-sm-9"><strong>${item.user}</strong></div>
            </div>
            <div class="row">
                <div class="col-sm-3">Tipo:</div>
                <div class="col-sm-9 text-capitalize">${item.user_type}</div>
            </div>
            ${
              item.funcionario_matricula
                ? `
            <div class="row">
                <div class="col-sm-3">Matrícula Funcionário:</div>
                <div class="col-sm-9">${item.funcionario_matricula}</div>
            </div>
            `
                : ""
            }
            ${
              item.funcionario_nome && item.funcionario_nome !== item.user
                ? `
            <div class="row">
                <div class="col-sm-3">Funcionário:</div>
                <div class="col-sm-9">${item.funcionario_nome}</div>
            </div>
            `
                : ""
            }
            ${
              item.solicitante_nome && !isDevolucao
                ? `
            <div class="row">
                <div class="col-sm-3">Solicitante:</div>
                <div class="col-sm-9">${item.solicitante_nome}</div>
            </div>
            `
                : ""
            }
            ${
              isDevolucao && item.responsavel_recebimento
                ? `
            <div class="row">
                <div class="col-sm-3">Responsável Recebimento:</div>
                <div class="col-sm-9">${item.responsavel_recebimento}</div>
            </div>
            `
                : ""
            }
        </div>
        
        <div class="detail-section">
            <h6><i class="fas fa-hard-hat me-2"></i>Equipamento</h6>
            <div class="row">
                <div class="col-sm-3">Nome:</div>
                <div class="col-sm-9"><strong>${item.equipment}</strong></div>
            </div>
            ${
              item.equipamento_codigo
                ? `
            <div class="row">
                <div class="col-sm-3">Código:</div>
                <div class="col-sm-9">${item.equipamento_codigo}</div>
            </div>
            `
                : ""
            }
            <div class="row">
                <div class="col-sm-3">Quantidade:</div>
                <div class="col-sm-9">
                    <span class="quantity-badge">${item.quantity}</span>
                </div>
            </div>
            ${
              item.estado_item
                ? `
            <div class="row">
                <div class="col-sm-3">Estado do Item:</div>
                <div class="col-sm-9">
                    <span class="badge bg-secondary">${item.estado_item}</span>
                </div>
            </div>
            `
                : ""
            }
        </div>
        
        <div class="detail-section">
            <h6><i class="fas fa-comment me-2"></i>Detalhes da Ação</h6>
            <div class="row">
                <div class="col-sm-3">Motivo:</div>
                <div class="col-sm-9 ${getActionColor(item.action_type)}">${item.reason}</div>
            </div>
            <div class="row">
                <div class="col-sm-3">Observações:</div>
                <div class="col-sm-9">${item.observations}</div>
            </div>
        </div>
    `

  const modal = new bootstrap.Modal(document.getElementById("detailModal"))
  modal.show()
}

function clearFilters() {
  document.getElementById("searchInput").value = ""
  document.getElementById("actionTypeFilter").value = ""
  // document.getElementById("statusFilter").value = ""
  document.getElementById("startDate").value = ""
  document.getElementById("endDate").value = ""
  currentPage = 1
  loadData()
}

function refreshData() {
  currentPage = 1
  loadData()
}

function buildAPIParams() {
  const params = new URLSearchParams()

  // Add search parameter
  const searchTerm = document.getElementById("searchInput").value.trim()
  if (searchTerm) {
    params.append("search", searchTerm)
  }

  // Add status filter
  // const statusFilter = document.getElementById("statusFilter").value
  // if (statusFilter) {
  //   params.append("status", statusFilter)
  // }

  // Add date filters
  const startDate = document.getElementById("startDate").value
  if (startDate) {
    params.append("data_inicio", startDate)
  }

  const endDate = document.getElementById("endDate").value
  if (endDate) {
    params.append("data_fim", endDate)
  }

  const actionType = document.getElementById("actionTypeFilter").value
  if (actionType) {
    params.append("action_type", actionType)
  }

  // Add pagination
  params.append("page", currentPage.toString())
  params.append("page_size", pageSize.toString())

  // Add ordering
  const orderField = sortDirection === "desc" ? `-${sortColumn}` : sortColumn
  params.append("ordering", orderField)

  return params
}

function showLoading(show) {
  const spinner = document.getElementById("loadingSpinner")
  if (show) {
    spinner.classList.remove("d-none")
  } else {
    spinner.classList.add("d-none")
  }
}

function showErrorState(message) {
  console.error("Error:", message)

  const emptyState = document.getElementById("emptyState")
  if (emptyState) {
    emptyState.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
        <h5 class="text-danger">Erro ao carregar dados</h5>
        <p class="text-muted">${message}</p>
        <button class="btn btn-primary" onclick="refreshData()">
          <i class="fas fa-sync-alt me-1"></i>
          Tentar Novamente
        </button>
      </div>
    `
    emptyState.classList.remove("d-none")
  }
}

function hideErrorState() {
  const emptyState = document.getElementById("emptyState")
  if (emptyState) {
    emptyState.innerHTML = `
      <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
      <h5 class="text-muted">Nenhum registro encontrado</h5>
      <p class="text-muted">Tente ajustar os filtros para encontrar os dados desejados</p>
    `
  }
}

async function makeAPIRequest(endpoint, params = new URLSearchParams()) {
  try {
    const url = `${API_CONFIG.baseURL}${endpoint}?${params.toString()}`
    // console.log("Making API request to:", url)

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRFToken": getCSRFToken(),
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    // console.log("API Response:", data)
    return { success: true, data: data }
  } catch (error) {
    console.error("Erro ao fazer a requisição:", error)
    return { success: false, error: error.message || "Erro ao fazer a requisição" }
  }
}

function getCSRFToken() {
  const cookieValue = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrftoken="))
    ?.split("=")[1]

  if (cookieValue) return cookieValue

  const metaTag = document.querySelector('meta[name="csrf-token"]')
  return metaTag ? metaTag.getAttribute("content") : ""
}

// Prevent default behavior for pagination links
document.addEventListener("click", (e) => {
  if (e.target.closest(".page-link")) {
    e.preventDefault()
  }
})

// Add loading animation CSS
const loadingCSS = `
.loading-row {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
`

const style = document.createElement("style")
style.textContent = loadingCSS
document.head.appendChild(style)
