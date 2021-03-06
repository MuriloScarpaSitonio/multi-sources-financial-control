# Generated by Django 3.2.5 on 2022-01-08 14:30

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0005_integrationsecret_binance_api_secret'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='integrationsecret',
            constraint=models.CheckConstraint(check=models.Q(models.Q(('binance_api_key__isnull', True), ('binance_api_secret__isnull', True)), models.Q(('binance_api_key__isnull', False), ('binance_api_secret__isnull', False)), _connector='OR'), name='binance_secrets_all_null_or_all_filled'),
        ),
    ]
