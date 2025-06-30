from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import Q
from usuario.decorators import somente_master
from usuario.models import Funcionario
from solicitacao.models import Solicitacao
from equipamento.models import DadosSolicitacao, Equipamento

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
    sort_field = request.GET.get('sort', 'data_solicitacao')  # Campo padrão alterado
    order = request.GET.get('order', 'desc')

    # Consulta base - agora partindo de Solicitacao
    query = Solicitacao.objects.select_related(
        'funcionario', 'solicitante'
    ).prefetch_related(
        'dados_solicitacao__equipamento'
    )

    # Aplica filtro de busca se existir
    if search:
        query = query.filter(
            Q(id__icontains=search) |
            Q(funcionario__nome__icontains=search) |
            Q(funcionario__matricula__icontains=search) |
            Q(dados_solicitacao__equipamento__nome__icontains=search)
        ).distinct()

    # Mapeamento de campos de ordenação
    field_mapping = {
        'data_solicitacao': 'data_solicitacao',
        'funcionario': 'funcionario__nome',
        'matricula': 'funcionario__matricula',
        'status': 'status',
    }
    
    # Verifica se o campo de ordenação existe no mapeamento
    sort_field = field_mapping.get(sort_field, sort_field)
    
    # Ordenação
    if order == 'desc':
        sort_field = f'-{sort_field}'
    query = query.order_by(sort_field)

    # Total de registros (antes da paginação)
    total_count = query.count()

    # Paginação
    paginator = Paginator(query, per_page)
    try:
        solicitacoes = paginator.page(page)
    except PageNotAnInteger:
        solicitacoes = paginator.page(1)
    except EmptyPage:
        solicitacoes = paginator.page(paginator.num_pages)

    # Estrutura de resposta
    dados_formatados = []
    for solicitacao in solicitacoes:
        # Obtém todos os itens da solicitação
        itens = []
        for dado in solicitacao.dados_solicitacao.all():
            itens.append({
                'quantidade': dado.quantidade,
                'motivo': dado.motivo,
                'observacoes': dado.observacoes,
                'equipamento_codigo': dado.equipamento.codigo,
                'equipamento_nome': dado.equipamento.nome,
            })

        dados_formatados.append({
            'id': solicitacao.id,
            'solicitacao_id': solicitacao.id,
            'data_solicitacao': solicitacao.data_solicitacao.isoformat(),
            'funcionario_id': solicitacao.funcionario.id,
            'funcionario_matricula': solicitacao.funcionario.matricula,
            'funcionario_nome': solicitacao.funcionario.nome,
            'status_assinatura': solicitacao.status,
            'solicitante_matricula': solicitacao.solicitante.matricula,
            'solicitante_nome': solicitacao.solicitante.nome,
            'itens': itens,
            'observacoes_gerais': solicitacao.observacoes,
        })

    return JsonResponse({
        'dados_solicitados': dados_formatados,
        'total_itens': total_count,
        'page': page,
        'per_page': per_page
    })

@login_required
@somente_master
@require_http_methods(["GET", "PUT", "PATCH"])
def alter_solicitacao(request, id):
    # Removido o parâmetro func_id pois agora o funcionário está na solicitação
    try:
        solicitacao = Solicitacao.objects.select_related(
            'funcionario', 'solicitante'
        ).prefetch_related(
            'dados_solicitacao__equipamento'
        ).get(id=id)
        
        # Obter todos os equipamentos disponíveis
        equipamentos = Equipamento.objects.filter(ativo=True).values('id', 'nome', 'codigo').order_by("id")
    
        # Obter dados da solicitação específica (não precisa mais filtrar por funcionário)
        dados_solicitacao = []
        for dado in solicitacao.dados_solicitacao.all():
            dados_solicitacao.append({
                'id': dado.id,
                'equipamento_id': dado.equipamento.id,
                'equipamento_nome': dado.equipamento.nome,
                'quantidade': dado.quantidade,
                'motivo': dado.motivo,
                'observacoes': dado.observacoes,
            })
        
        return JsonResponse({
            'success': True,
            'solicitacao': {
                'id': solicitacao.id,
                'status': solicitacao.status,
                'solicitante_id': solicitacao.solicitante.id if solicitacao.solicitante else None,
                'solicitante_nome': solicitacao.solicitante.nome if solicitacao.solicitante else None,
                'funcionario_id': solicitacao.funcionario.id if solicitacao.funcionario else None,
                'funcionario_nome': solicitacao.funcionario.nome if solicitacao.funcionario else None,
                'funcionario_matricula': solicitacao.funcionario.matricula if solicitacao.funcionario else None,
                'data_solicitacao': solicitacao.data_solicitacao.strftime("%Y-%m-%d %H:%M:%S"),
                'observacoes_gerais': solicitacao.observacoes,
                'dados_solicitacao': dados_solicitacao
            },
            'equipamentos': list(equipamentos),
            'funcionarios_disponiveis': list(Funcionario.objects.filter(ativo=True).values('id', 'matricula', 'nome')),
            'motivos': list(DadosSolicitacao.REASON_CHOICES)
        }, status=200)
        
    except Solicitacao.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Solicitação não encontrada'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)