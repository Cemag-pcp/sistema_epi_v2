from django.db import models
from usuario.models import Setor
from equipamento.models import Equipamento


class Padrao(models.Model):
    nome = models.CharField(max_length=150)
    setor = models.ForeignKey(Setor, on_delete=models.CASCADE, related_name='setor_padrao')
    itens = models.ManyToManyField(Equipamento, related_name='padroes')
    ativo = models.BooleanField(default=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.nome} - {self.setor}'
