from django.db import models
from solicitacao.models import Solicitacao

class Devolucao(models.Model):
    solicitacao = models.ForeignKey(Solicitacao, on_delete=models.CASCADE, related_name='solicitacao_devolucao')
    responsavel_recebimento = models.ForeignKey(Solicitacao, on_delete=models.CASCADE, related_name='responsavel_recebimento')
    data_devolucao = models.DateTimeField(auto_now_add=True)
    motivo = models.CharField(max_length=255)
    observacoes = models.CharField(max_length=255, blank=True, null=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

