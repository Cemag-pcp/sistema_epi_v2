# Generated by Django 5.2.1 on 2025-05-21 21:13

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuario', '0010_alter_funcionario_setor'),
    ]

    operations = [
        migrations.AlterField(
            model_name='funcionario',
            name='setor',
            field=models.CharField(max_length=150, null=True),
        ),
    ]
