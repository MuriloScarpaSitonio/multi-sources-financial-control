# Generated by Django 4.2.3 on 2023-12-07 23:59

import decimal
from decimal import Decimal
import django.core.validators
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("variable_income_assets", "0017_remove_passiveincome_fetched_by_and_more"),
    ]

    operations = [
        migrations.RenameField(
            model_name="assetreadmodel",
            old_name="total_bought",
            new_name="normalized_total_bought",
        ),
        migrations.RemoveField(
            model_name="transaction",
            name="initial_price",
        ),
        migrations.AddField(
            model_name="assetreadmodel",
            name="normalized_avg_price",
            field=models.DecimalField(decimal_places=8, default=Decimal("0"), max_digits=15),
        ),
        migrations.AddField(
            model_name="assetreadmodel",
            name="normalized_closed_roi",
            field=models.DecimalField(decimal_places=4, default=Decimal("0"), max_digits=20),
        ),
        migrations.CreateModel(
            name="AssetClosedOperation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "normalized_total_sold",
                    models.DecimalField(
                        decimal_places=4,
                        max_digits=20,
                        validators=[django.core.validators.MinValueValidator(Decimal("0.0001"))],
                    ),
                ),
                (
                    "normalized_total_bought",
                    models.DecimalField(
                        decimal_places=4,
                        max_digits=20,
                        validators=[django.core.validators.MinValueValidator(Decimal("0.0001"))],
                    ),
                ),
                (
                    "total_bought",
                    models.DecimalField(
                        decimal_places=4,
                        max_digits=20,
                        validators=[django.core.validators.MinValueValidator(Decimal("0.0001"))],
                    ),
                ),
                (
                    "quantity_bought",
                    models.DecimalField(
                        decimal_places=4,
                        max_digits=20,
                        validators=[django.core.validators.MinValueValidator(Decimal("0.0001"))],
                    ),
                ),
                (
                    "normalized_credited_incomes",
                    models.DecimalField(decimal_places=2, default=decimal.Decimal, max_digits=20),
                ),
                (
                    "credited_incomes",
                    models.DecimalField(decimal_places=2, default=decimal.Decimal, max_digits=20),
                ),
                ("operation_datetime", models.DateTimeField()),
                (
                    "asset",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="closed_operations",
                        to="variable_income_assets.asset",
                    ),
                ),
            ],
        ),
    ]
