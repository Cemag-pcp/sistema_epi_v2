from django.db import models
from solicitacao.models import Solicitacao


class Equipamento(models.Model):
    nome = models.CharField(max_length=150)
    codigo = models.CharField(max_length=50, unique=True)
    vida_util_dias = models.IntegerField(default=365, null=False, blank=False)
    ca = models.IntegerField(null=True, blank=True, default=0)
    ativo = models.BooleanField(default=True)
    

class EquipamentoSolicitacao(models.Model):
    solicitacao = models.ForeignKey(Solicitacao, on_delete=models.CASCADE, related_name='solicitacao_equipamento')
    equipamento = models.ForeignKey(Equipamento, on_delete=models.CASCADE, related_name='equipamento')
    quantidade = models.PositiveIntegerField(default=1)
    observacoes = models.CharField(max_length=255, blank=True, null=True)
