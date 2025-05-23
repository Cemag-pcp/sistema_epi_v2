from django.db import models


class Equipamento(models.Model):
    nome = models.CharField(max_length=150)
    descricao = models.TextField(blank=True, null=True)
    codigo = models.CharField(max_length=50, unique=True)
    ativo = models.BooleanField(default=True)
    

