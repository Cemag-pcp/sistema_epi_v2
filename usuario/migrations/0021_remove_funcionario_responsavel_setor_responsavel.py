# Generated by Django 5.2.1 on 2025-05-28 20:29

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuario', '0020_funcionario_responsavel'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='funcionario',
            name='responsavel',
        ),
        migrations.AddField(
            model_name='setor',
            name='responsavel',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='responsavel', to='usuario.funcionario'),
        ),
    ]
