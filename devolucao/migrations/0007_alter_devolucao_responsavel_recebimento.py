# Generated by Django 5.0.6 on 2025-07-02 17:06

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('devolucao', '0006_rename_solicitacao_devolucao_dados_solicitacao'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='devolucao',
            name='responsavel_recebimento',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='responsavel_recebimento', to=settings.AUTH_USER_MODEL),
        ),
    ]
