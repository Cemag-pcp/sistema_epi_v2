# Generated by Django 5.2.1 on 2025-06-24 14:15

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('padrao', '0010_alter_padraoequipamento_motivo'),
    ]

    operations = [
        migrations.AlterField(
            model_name='padraoequipamento',
            name='motivo',
            field=models.CharField(choices=[('primeira entrega', 'Primeira Entrega'), ('substituicao', 'Substituição'), ('perda', 'Perda'), ('dano', 'Dano')], default='substituicao', max_length=20),
        ),
    ]
