# Generated by Django 5.2.1 on 2025-05-30 11:32

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('padrao', '0007_padrao_observacoes'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='padrao',
            name='observacoes',
        ),
        migrations.AddField(
            model_name='padraoequipamento',
            name='observacoes',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
