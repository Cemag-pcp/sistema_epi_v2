from django.db import models
from usuario.models import Funcionario
from solicitacao.models import Solicitacao


class Equipamento(models.Model):
    nome = models.CharField(max_length=150)
    codigo = models.CharField(max_length=50, unique=True)
    vida_util_dias = models.IntegerField(default=365, null=False, blank=False)
    ca = models.IntegerField(null=True, blank=True, default=0)
    ativo = models.BooleanField(default=True)
    

class DadosSolicitacao(models.Model):
    
    REASON_CHOICES = [
        ('primeira entrega', 'Primeira Entrega'),
        ('substituicao', 'Substituição'),
        ('perda', 'Perda'),
        ('dano', 'Dano'),
    ]

    solicitacao = models.ForeignKey(Solicitacao, on_delete=models.CASCADE, related_name='dados_solicitacao')
    equipamento = models.ForeignKey(Equipamento, on_delete=models.CASCADE, related_name='dados_equipamento')
    funcionario = models.ForeignKey(Funcionario, on_delete=models.CASCADE, related_name='dados_funcionario')
    quantidade = models.PositiveIntegerField(default=1)
    motivo = models.CharField(max_length=20, choices=REASON_CHOICES, default='substituicao')
    observacoes = models.CharField(max_length=255, blank=True, null=True)
