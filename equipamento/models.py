from django.db import models


class Equipamento(models.Model):
    nome = models.CharField(max_length=150)
    codigo = models.CharField(max_length=50, unique=True)
    tem_vida_util = models.BooleanField(default=True)
    vida_util_dias = models.IntegerField(default=365, null=True, blank=True)
    ca = models.IntegerField(null=True, blank=True, default=0)
    ativo = models.BooleanField(default=True)
    
