from django.db import models
from usuario.models import Setor, Funcionario


class Checklist(models.Model):

    setor = models.ForeignKey(
        Setor, on_delete=models.SET_NULL, null=True, blank=True, related_name="setor"
    )
    nome = models.CharField(max_length=100, unique=True)
    descricao = models.TextField()
    ativo = models.BooleanField(default=False)

    def __str__(self):
        return self.nome


class Pergunta(models.Model):

    checklist = models.ForeignKey(
        Checklist,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="checklist",
    )
    texto = models.TextField()

    def __str__(self):
        return self.texto


class Inspecao(models.Model):

    checklist = models.ForeignKey(
        Checklist,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="checklist",
    )
    inspetor = models.ForeignKey(
        Funcionario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspetor",
    )
    data_inspecao = models.DateTimeField(auto_now=True)


class ItemResposta(models.Model):

    inspecao = models.ForeignKey(
        Inspecao,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspecao",
    )
    pergunta = models.ForeignKey(
        Pergunta,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pergunta",
    )
    conformidade = models.BooleanField(default=True)
    texto_pergunta_historico = models.TextField()
    observacao = models.TextField()
