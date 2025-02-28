# Generated by Django 4.2.3 on 2025-02-26 23:12

from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        (
            "variable_income_assets",
            "0021_remove_assetmetadata_code__type__currency__unique_together_and_more",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="assetmetadata",
            name="code",
            field=models.CharField(max_length=200),
        ),
        migrations.AlterField(
            model_name="passiveincome",
            name="current_currency_conversion_rate",
            field=models.DecimalField(
                blank=True, decimal_places=2, default=Decimal("1"), max_digits=8
            ),
        ),
    ]
