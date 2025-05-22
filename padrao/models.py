from django.db import models
from usuario.models import Setor


class Padrao(models.Model):
    cargo = models.CharField(max_length=150)
    setor = models.ForeignKey(Setor, on_delete=models.CASCADE, related_name='setor_padrao')
    itens = models.JSONField()
    ativo = models.BooleanField(default=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.cargo} - {self.setor}'
