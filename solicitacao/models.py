from django.db import models
from usuario.models import Usuario, Funcionario
from equipamento.models import Equipamento

class Solicitacao(models.Model):
    STATUS_CHOICES = [
        ('Pendente', 'PENDENTE'),
        ('Cancelado', 'CANCELADO'),
        ('Entregue', 'ENTREGUE'),
    ]
    solicitante = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    funcionario = models.ForeignKey(Funcionario, on_delete=models.CASCADE, default=1)
    data_solicitacao = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Pendente')
    observacoes = models.CharField(max_length=255, blank=True, null=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Solicitação #{self.id} - {self.status}"
    
class DadosSolicitacao(models.Model):
    
    REASON_CHOICES = [
        ('primeira entrega', 'Primeira Entrega'),
        ('substituicao', 'Substituição'),
        ('perda', 'Perda'),
        ('dano', 'Dano'),
    ]

    solicitacao = models.ForeignKey(Solicitacao, on_delete=models.CASCADE, related_name='dados_solicitacao')
    equipamento = models.ForeignKey(Equipamento, on_delete=models.CASCADE, related_name='dados_equipamento')
    quantidade = models.PositiveIntegerField(default=1)
    motivo = models.CharField(max_length=20, choices=REASON_CHOICES, default='substituicao')
    observacoes = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        unique_together = ('equipamento', 'solicitacao')

class Assinatura(models.Model):
    imagem_assinatura = models.ImageField(upload_to='assinatura/')
    data_criacao = models.DateTimeField(auto_now_add=True)