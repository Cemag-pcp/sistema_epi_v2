from django.db import models
from usuario.models import Setor, Funcionario
from datetime import datetime
import os

def foto_upload_path(instance, filename):
    """Gera o caminho de upload para as fotos: inspecao_{id}/pergunta_{id}/{filename}"""
    return f'inspecao_{instance.item_resposta.inspecao.id}/pergunta_{instance.item_resposta.pergunta.id}/{filename}'

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
    
    def delete(self, *args, **kwargs):
        self.ativo = False
        self.save()

    def get_stats(self, inspecao):
        """Método para calcular estatísticas de uma inspecão específica"""
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
    causas_reprovacao = models.TextField(null=True, blank=True)
    acoes_corretivas = models.TextField(null=True, blank=True)
    texto_pergunta_historico = models.TextField()
    observacao = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.pergunta.texto if self.pergunta else 'Pergunta removida'} - {'Conforme' if self.conformidade else 'Não Conforme'}"

    def get_fotos(self):
        """Retorna todas as fotos associadas a esta resposta"""
        return self.fotos.all()


class FotoResposta(models.Model):
    item_resposta = models.ForeignKey(
        ItemResposta,
        on_delete=models.CASCADE,
        related_name="fotos",
        verbose_name="Resposta da pergunta"
    )
    foto = models.ImageField(
        upload_to=foto_upload_path,
        verbose_name="Foto",
        null=True,
        blank=True
    )
    data_upload = models.DateTimeField(auto_now_add=True)
    descricao = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"Foto para {self.item_resposta}"

    def delete(self, *args, **kwargs):
        """Override do delete para remover o arquivo físico"""
        if self.foto:
            if os.path.isfile(self.foto.path):
                os.remove(self.foto.path)
        super().delete(*args, **kwargs)

    class Meta:
        ordering = ['data_upload']
        verbose_name = 'Foto da Resposta'
        verbose_name_plural = 'Fotos das Respostas'