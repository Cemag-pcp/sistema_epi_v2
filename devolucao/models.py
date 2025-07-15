from django.db import models
from solicitacao.models import DadosSolicitacao
from usuario.models import Usuario

class Devolucao(models.Model):
    ESTADO_CHOICES = (
        ('bom', 'Bom'),
        ('ruim', 'Ruim'),
        ('danificado', 'Danificado'),
    )

    dados_solicitacao = models.ForeignKey(DadosSolicitacao, on_delete=models.CASCADE, related_name='dados_solicitacao_devolucao')
    responsavel_recebimento = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='responsavel_recebimento')
    estado_item = models.CharField(max_length=30, choices=ESTADO_CHOICES, default='bom')
    data_devolucao = models.DateTimeField(auto_now_add=True)
    observacoes = models.CharField(max_length=255, blank=True, null=True)
    data_atualizacao = models.DateTimeField(auto_now=True)
    quantidade_devolvida = models.PositiveIntegerField()