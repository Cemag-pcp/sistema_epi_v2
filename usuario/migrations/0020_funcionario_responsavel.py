# Generated by Django 5.0.6 on 2025-05-23 17:53

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuario', '0019_remove_funcionario_responsavel'),
    ]

    operations = [
        migrations.AddField(
            model_name='funcionario',
            name='responsavel',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='responsavel_funcionario', to='usuario.funcionario'),
        ),
    ]
