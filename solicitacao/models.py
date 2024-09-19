from django.db import models
from usuario.models import Usuario

from cadastro.models import Item

class Solicitacao(models.Model):
    lider = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='solicitacoes_lider')
    liderado = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='solicitacao_liderado')
    data_solicitacao = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=(('pendente', 'Pendente'), ('assinada', 'Assinada'), ('rejeitada', 'Rejeitada')), default='pendente')
    observacao = models.TextField(blank=True, null=True)
    motivo_rejeitada = models.CharField(max_length=50, blank=True, null=True)
    primeira_entrega = models.BooleanField(default=False)
    assinatura = models.ImageField(upload_to='assinaturas/', blank=True, null=True)

    def __str__(self):
        return f"Solicitação {self.id} por {self.lider} - {self.status}"
    
class ItemSolicitado(models.Model):
    solicitacao = models.ForeignKey(Solicitacao, on_delete=models.CASCADE, related_name='itens_solicitados')
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='item_solicitacao')
    liderado = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='itens_recebidos')
    quantidade = models.IntegerField()
    motivo = models.CharField(max_length=20, choices=(('perda', 'Perda'), ('substituicao', 'Substituição'), ('dano', 'Dano')))
    
    def __str__(self):
        return f"{self.quantidade} de {self.item} para {self.liderado}"

class SolicitacaoPadrao(models.Model):
    nome = models.CharField(max_length=100)  # Nome da solicitação padrão
    lider = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='solicitacoes_padrao')
    observacao = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Solicitação Padrão: {self.nome} por {self.lider}"

class ItemSolicitadoPadrao(models.Model):
    solicitacao_padrao = models.ForeignKey(SolicitacaoPadrao, on_delete=models.CASCADE, related_name='itens_padrao')
    liderado = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='itens_padrao_recebidos')
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='item_padrao_solicitacao')
    quantidade = models.IntegerField()
    primeira_entrega = models.BooleanField(default=False)
    motivo = models.CharField(max_length=20, choices=(('perda', 'Perda'), ('substituicao', 'Substituição'), ('dano', 'Dano')))

    def __str__(self):
        return f"{self.quantidade} de {self.item} para {self.liderado}"
