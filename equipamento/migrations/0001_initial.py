# Generated by Django 5.2.1 on 2025-05-13 20:19

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Equipamento',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=150)),
                ('descricao', models.TextField(blank=True, null=True)),
                ('codigo', models.CharField(max_length=50, unique=True)),
                ('ativo', models.BooleanField(default=True)),
            ],
        ),
    ]
