# Generated by Django 5.2.1 on 2025-06-25 12:16

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('equipamento', '0011_dadossolicitacao_delete_equipamentosolicitacao'),
        ('solicitacao', '0009_alter_solicitacao_solicitante'),
        ('usuario', '0026_cargo_alter_funcionario_cargo'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='dadossolicitacao',
            unique_together={('equipamento', 'funcionario', 'solicitacao')},
        ),
    ]
