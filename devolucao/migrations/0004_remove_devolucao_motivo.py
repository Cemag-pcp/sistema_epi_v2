# Generated by Django 5.0.6 on 2025-07-02 12:51

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('devolucao', '0003_remove_devolucao_data_criacao_devolucao_estado_item_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='devolucao',
            name='motivo',
        ),
    ]
