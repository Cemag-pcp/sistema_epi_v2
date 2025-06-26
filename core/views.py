from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import Q
from usuario.decorators import somente_master
from solicitacao.models import Solicitacao
from equipamento.models import DadosSolicitacao

# Create your views here.

@login_required
@somente_master
def home(request):
    return render(request, 'home.html')

@login_required
@somente_master
def home_solicitacoes(request):
    # Parâmetros de paginação e ordenação
    page = int(request.GET.get('page', 1))
    per_page = int(request.GET.get('per_page', 10))
    search = request.GET.get('search', '')
    sort_field = request.GET.get('sort', 'solicitacao__data_solicitacao')
    order = request.GET.get('order', 'desc')

    # Consulta base
    query = DadosSolicitacao.objects.select_related(
        'solicitacao', 'equipamento', 'funcionario'
    )

    # Aplica filtro de busca se existir
    if search:
        query = query.filter(
            Q(solicitacao__id__icontains=search) |
            Q(funcionario__nome__icontains=search) |
            Q(funcionario__matricula__icontains=search) |
            Q(equipamento__nome__icontains=search)
        )

    # Ordenação
    if order == 'desc':
        sort_field = f'-{sort_field}'
    query = query.order_by(sort_field)

    # Total de registros (antes da paginação)
    total_count = query.count()

    # Paginação
    paginator = Paginator(query, per_page)
    try:
        items = paginator.page(page)
    except PageNotAnInteger:
        items = paginator.page(1)
    except EmptyPage:
        items = paginator.page(paginator.num_pages)

    # Agrupa os resultados por solicitação
    agrupados = {}
    for item in items:
        chave = (item.solicitacao.id, item.funcionario.matricula)
        
        if chave not in agrupados:
            agrupados[chave] = {
                'id': item.id,
                'solicitacao_id': item.solicitacao.id,
                'data_solicitacao': item.solicitacao.data_solicitacao.isoformat(),
                'responsavel_entrega_matricula': item.solicitacao.responsavel_entrega.matricula if item.solicitacao.responsavel_entrega else '',
                'responsavel_entrega_nome': item.solicitacao.responsavel_entrega.nome if item.solicitacao.responsavel_entrega else '',
                'funcionario_matricula': item.funcionario.matricula,
                'funcionario_nome': item.funcionario.nome,
                'status_assinatura': item.solicitacao.status,
                'itens': []
            }
        
        agrupados[chave]['itens'].append({
            'quantidade': item.quantidade,
            'motivo': item.motivo,
            'observacoes': item.observacoes,
            'equipamento_codigo': item.equipamento.codigo,
            'equipamento_nome': item.equipamento.nome,
        })

    return JsonResponse({
        'dados_solicitados': list(agrupados.values()),
        'total_itens': total_count,
        'page': page,
        'per_page': per_page
    })