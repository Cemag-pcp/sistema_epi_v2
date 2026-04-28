from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuario', '0031_ddsassinatura'),
    ]

    operations = [
        migrations.AddField(
            model_name='dds',
            name='conteudo_programatico',
            field=models.TextField(default=''),
        ),
    ]
