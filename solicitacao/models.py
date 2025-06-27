from django.db import models
from usuario.models import Usuario, Funcionario


class Solicitacao(models.Model):
    STATUS_CHOICES = [
        ('Pendente', 'PENDENTE'),
        ('Cancelado', 'CANCELADO'),
        ('Entregue', 'ENTREGUE'),
    ]

    solicitante = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    responsavel_entrega = models.ForeignKey(Funcionario, on_delete=models.SET_NULL, null=True, blank=True, related_name='responsavel_entrega')
    data_solicitacao = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Pendente')
    observacoes = models.CharField(max_length=255, blank=True, null=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Solicitação #{self.id} - {self.status}"

class Assinatura(models.Model):
    imagem_assinatura = models.ImageField(upload_to='assinatura/')
    data_criacao = models.DateTimeField(auto_now_add=True)