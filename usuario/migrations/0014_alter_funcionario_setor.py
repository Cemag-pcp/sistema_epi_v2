# Generated by Django 5.2.1 on 2025-05-22 15:35

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuario', '0013_setor_alter_funcionario_setor'),
    ]

    operations = [
        migrations.AlterField(
            model_name='funcionario',
            name='setor',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='setor_funcionario', to='usuario.setor'),
        ),
    ]
