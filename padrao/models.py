from django.db import models
from usuario.models import Setor
from equipamento.models import Equipamento
from usuario.models import Funcionario


class Padrao(models.Model):
    nome = models.CharField(max_length=150)
    setor = models.ForeignKey(Setor, on_delete=models.CASCADE, related_name='setor_padrao')
    ativo = models.BooleanField(default=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)
    
    funcionarios = models.ManyToManyField(
        Funcionario, 
        through='PadraoFuncionario',
        related_name='padroes'
    )
    
    def __str__(self):
        return f'{self.nome} - {self.setor}'

class PadraoFuncionario(models.Model):
    padrao = models.ForeignKey(Padrao, on_delete=models.CASCADE)
    funcionario = models.ForeignKey(Funcionario, on_delete=models.CASCADE)
    
    class Meta:
        unique_together = ('padrao', 'funcionario')

class PadraoEquipamento(models.Model):
    padrao_funcionario = models.ForeignKey(PadraoFuncionario, on_delete=models.CASCADE, related_name='equipamentos')
    equipamento = models.ForeignKey(Equipamento, on_delete=models.CASCADE)
    quantidade = models.PositiveIntegerField(default=1)
    observacoes = models.CharField(max_length=255, blank=True, null=True)
    
    class Meta:
        unique_together = ('padrao_funcionario', 'equipamento')