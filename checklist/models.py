from django.db import models
from usuario.models import Setor, Funcionario
from datetime import datetime

class Checklist(models.Model):
    setor = models.ForeignKey(
        Setor, on_delete=models.SET_NULL, null=True, blank=True, related_name="setor"
    )
    nome = models.CharField(max_length=100, unique=True)
    descricao = models.TextField(blank=True, null=True)
    ativo = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    update_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nome

    def get_stats(self, inspecao):
        """Método para calcular estatísticas de uma inspeção específica"""
        itens = ItemResposta.objects.filter(inspecao=inspecao)
        total = itens.count()
        compliant = itens.filter(conformidade=True).count()
        non_compliant = total - compliant
        
        return {
            'total': total,
            'compliant': compliant,
            'nonCompliant': non_compliant
        }


class Pergunta(models.Model):
    checklist = models.ForeignKey(
        Checklist,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="perguntas",
    )
    texto = models.TextField()

    def __str__(self):
        return self.texto


class Inspecao(models.Model):
    checklist = models.ForeignKey(
        Checklist,
        on_delete=models.CASCADE,
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

    def __str__(self):
        return f"{self.checklist.nome} - {self.data_inspecao}"

    class Meta:
        ordering = ['-data_inspecao']


class ItemResposta(models.Model):
    inspecao = models.ForeignKey(
        Inspecao,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="itens_resposta",
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
    observacao = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.pergunta.texto} - {'Conforme' if self.conformidade else 'Não Conforme'}"