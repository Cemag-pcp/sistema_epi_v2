from django.db import models
from usuario.models import Usuario


class Solicitacao(models.Model):

    STATUS_CHOICES = [
        ('Pendente', 'PENDENTE'),
        ('Cancelado', 'CANCELADO'),
        ('Entregue', 'ENTREGUE'),
    ]

    solicitante = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    responsavel_entrega = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='responsavel_entrega')
    data_solicitacao = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=30,choices=STATUS_CHOICES, default='Pendente')
    observacoes = models.CharField(max_length=255, blank=True, null=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

