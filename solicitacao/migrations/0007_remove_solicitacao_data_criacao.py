# Generated by Django 5.2.1 on 2025-06-24 14:52

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('solicitacao', '0006_remove_solicitacao_motivo'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='solicitacao',
            name='data_criacao',
        ),
    ]
