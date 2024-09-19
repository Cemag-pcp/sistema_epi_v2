from django.shortcuts import render

from solicitacao.models import Solicitacao, ItemSolicitado

from collections import defaultdict

def criar_solicitacoes(lider, itens_solicitados):
    # Agrupa os itens por liderado
    solicitacoes_por_liderado = defaultdict(list)
    
    for item in itens_solicitados:
        solicitacoes_por_liderado[item['liderado']].append(item)

    # Para cada liderado, cria uma nova solicitação
    for liderado, itens in solicitacoes_por_liderado.items():
        solicitacao = Solicitacao.objects.create(lider=lider, liderado=liderado, status='pendente')
        
        # Cria os itens solicitados para cada solicitação
        for item_data in itens:
            ItemSolicitado.objects.create(
                solicitacao=solicitacao,
                item=item_data['item'],
                quantidade=item_data['quantidade'],
                primeira_entrega=item_data.get('primeira_entrega', False),
                motivo=item_data['motivo']
            )
            
def criar_solicitacao_de_padrao(solicitacao_padrao):
    # Agrupa os itens padrão por liderado
    itens_por_liderado = defaultdict(list)
    
    for item_padrao in solicitacao_padrao.itens_padrao.all():
        itens_por_liderado[item_padrao.liderado].append(item_padrao)
    
    # Cria uma solicitação separada para cada liderado
    for liderado, itens in itens_por_liderado.items():
        nova_solicitacao = Solicitacao.objects.create(
            lider=solicitacao_padrao.lider,
            liderado=liderado,
            observacao=solicitacao_padrao.observacao,
            status='pendente'
        )
        
        # Cria os itens solicitados para a solicitação correspondente
        for item_padrao in itens:
            ItemSolicitado.objects.create(
                solicitacao=nova_solicitacao,
                item=item_padrao.item,
                quantidade=item_padrao.quantidade,
                primeira_entrega=item_padrao.primeira_entrega,
                motivo=item_padrao.motivo
            )
