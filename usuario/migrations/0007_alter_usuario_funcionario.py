# Generated by Django 5.2.1 on 2025-05-15 16:57

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuario', '0006_alter_usuario_funcionario'),
    ]

    operations = [
        migrations.AlterField(
            model_name='usuario',
            name='funcionario',
            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='funcionario', to='usuario.funcionario'),
        ),
    ]
