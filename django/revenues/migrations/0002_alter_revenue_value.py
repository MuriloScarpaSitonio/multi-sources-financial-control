# Generated by Django 3.2.5 on 2021-10-24 23:05

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('revenues', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='revenue',
            name='value',
            field=models.DecimalField(decimal_places=2, max_digits=10),
        ),
    ]