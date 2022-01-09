# Generated by Django 3.2.5 on 2021-12-24 00:31

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('variable_income_assets', '0005_transaction_external_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='currency',
            field=models.CharField(choices=[('BRL', 'Real'), ('USD', 'Dólar'), ('USDT', 'Tether')], default='BRL', max_length=6),
        ),
    ]
