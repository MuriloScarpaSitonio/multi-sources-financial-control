# Generated by Django 4.2.2 on 2023-07-04 19:08

from decimal import Decimal
from django.db import migrations, models
import django.db.models.deletion
import variable_income_assets.choices


class Migration(migrations.Migration):
    dependencies = [
        ("variable_income_assets", "0015_remove_assetreadmodel_sector"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="asset",
            options={},
        ),
        migrations.AlterModelOptions(
            name="passiveincome",
            options={},
        ),
        migrations.AlterModelOptions(
            name="transaction",
            options={},
        ),
        migrations.RenameField(
            model_name="transaction",
            old_name="created_at",
            new_name="operation_date",
        ),
        migrations.AlterUniqueTogether(
            name="asset",
            unique_together=set(),
        ),
        migrations.RemoveField(
            model_name="assetreadmodel",
            name="adjusted_avg_price",
        ),
        migrations.RemoveField(
            model_name="assetreadmodel",
            name="total_invested",
        ),
        migrations.RemoveField(
            model_name="assetreadmodel",
            name="total_invested_adjusted",
        ),
        migrations.RemoveField(
            model_name="transaction",
            name="currency",
        ),
        migrations.AddField(
            model_name="asset",
            name="currency",
            field=models.CharField(
                blank=True,
                max_length=6,
                validators=[],
            ),
        ),
        migrations.AddField(
            model_name="assetreadmodel",
            name="credited_incomes",
            field=models.DecimalField(decimal_places=4, default=Decimal("0"), max_digits=20),
        ),
        migrations.AddField(
            model_name="assetreadmodel",
            name="normalized_credited_incomes",
            field=models.DecimalField(decimal_places=4, default=Decimal("0"), max_digits=20),
        ),
        migrations.AddField(
            model_name="assetreadmodel",
            name="normalized_total_sold",
            field=models.DecimalField(decimal_places=4, default=Decimal("0"), max_digits=20),
        ),
        migrations.AddField(
            model_name="passiveincome",
            name="current_currency_conversion_rate",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True),
        ),
        migrations.AddField(
            model_name="transaction",
            name="current_currency_conversion_rate",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True),
        ),
        migrations.AlterField(
            model_name="assetreadmodel",
            name="metadata",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="user_read_assets",
                to="variable_income_assets.assetmetadata",
            ),
        ),
        migrations.AlterField(
            model_name="assetreadmodel",
            name="total_bought",
            field=models.DecimalField(decimal_places=4, default=Decimal("0"), max_digits=20),
        ),
        migrations.AlterField(
            model_name="passiveincome",
            name="amount",
            field=models.DecimalField(decimal_places=2, max_digits=12),
        ),
        migrations.AddConstraint(
            model_name="asset",
            constraint=models.UniqueConstraint(
                fields=("code", "type", "currency", "user"),
                name="code__type__currency__user__unique_together",
            ),
        ),
    ]
