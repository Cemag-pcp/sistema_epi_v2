from django.db import models
from solicitacao.models import Solicitacao
from usuario.models import Usuario

class Devolucao(models.Model):
    ESTADO_CHOICES = (
        ('bom', 'Bom'),
        ('ruim', 'Ruim'),
        ('danificado', 'Danificado'),
    )

    solicitacao = models.ForeignKey(Solicitacao, on_delete=models.CASCADE, related_name='solicitacao_devolucao')
    responsavel_recebimento = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='responsavel_recebimento')
    estado_item = models.CharField(max_length=30, choices=ESTADO_CHOICES, default='bom')
    data_devolucao = models.DateTimeField(auto_now_add=True)
    observacoes = models.CharField(max_length=255, blank=True, null=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)
    


