from django.db import models

class Item(models.Model):
    
    codigo = models.CharField(max_length=10, unique=True)
    descricao = models.CharField(max_length=50, null=True, blank=True)
    vida_util = models.IntegerField(blank=True, null=True, help_text='Vida útil do item (em dias)')
    ca = models.CharField(max_length=20, blank=True, null=True)
    
    def __str__(self):
        
        return f'{self.codigo} - {self.descricao}'
    

    
    