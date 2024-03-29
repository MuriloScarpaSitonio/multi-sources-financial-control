# Generated by Django 3.2.5 on 2023-03-23 22:18

from decimal import Decimal
from django.db import migrations, models
import variable_income_assets.choices


class Migration(migrations.Migration):
    dependencies = [
        ("variable_income_assets", "0011_alter_asset_sector"),
    ]

    operations = [
        migrations.CreateModel(
            name="AssetReadModel",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("code", models.CharField(max_length=10)),
                (
                    "type",
                    models.CharField(
                        max_length=10,
                        validators=[],
                    ),
                ),
                (
                    "sector",
                    models.CharField(
                        default="UNKNOWN",
                        max_length=50,
                        validators=[],
                    ),
                ),
                (
                    "objective",
                    models.CharField(
                        default="UNKNOWN",
                        max_length=50,
                        validators=[],
                    ),
                ),
                ("current_price", models.DecimalField(decimal_places=6, max_digits=13)),
                ("current_price_updated_at", models.DateTimeField(blank=True, null=True)),
                ("user_id", models.PositiveBigIntegerField(db_index=True, editable=False)),
                (
                    "write_model_pk",
                    models.PositiveBigIntegerField(db_index=True, editable=False, unique=True),
                ),
                (
                    "currency",
                    models.CharField(
                        blank=True,
                        max_length=6,
                        validators=[],
                    ),
                ),
                (
                    "quantity_balance",
                    models.DecimalField(decimal_places=8, default=Decimal("0"), max_digits=15),
                ),
                (
                    "avg_price",
                    models.DecimalField(decimal_places=8, default=Decimal("0"), max_digits=15),
                ),
                (
                    "adjusted_avg_price",
                    models.DecimalField(decimal_places=8, default=Decimal("0"), max_digits=15),
                ),
                ("roi", models.DecimalField(decimal_places=8, default=Decimal("0"), max_digits=15)),
                (
                    "roi_percentage",
                    models.DecimalField(decimal_places=8, default=Decimal("0"), max_digits=15),
                ),
                (
                    "total_invested",
                    models.DecimalField(decimal_places=8, default=Decimal("0"), max_digits=15),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.AlterField(
            model_name="asset",
            name="objective",
            field=models.CharField(
                default="UNKNOWN",
                max_length=50,
                validators=[],
            ),
        ),
        migrations.AlterField(
            model_name="asset",
            name="sector",
            field=models.CharField(
                default="UNKNOWN",
                max_length=50,
                validators=[],
            ),
        ),
        migrations.AlterField(
            model_name="asset",
            name="type",
            field=models.CharField(
                max_length=10,
                validators=[],
            ),
        ),
        migrations.AlterField(
            model_name="passiveincome",
            name="event_type",
            field=models.CharField(
                max_length=11,
                validators=[],
            ),
        ),
        migrations.AlterField(
            model_name="passiveincome",
            name="type",
            field=models.CharField(
                max_length=8,
                validators=[],
            ),
        ),
        migrations.AlterField(
            model_name="transaction",
            name="action",
            field=models.CharField(
                max_length=4,
                validators=[],
            ),
        ),
        migrations.AlterField(
            model_name="transaction",
            name="currency",
            field=models.CharField(
                default="BRL",
                max_length=6,
                validators=[],
            ),
        ),
    ]
