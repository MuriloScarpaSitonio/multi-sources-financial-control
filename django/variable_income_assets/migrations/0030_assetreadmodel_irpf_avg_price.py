from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        (
            "variable_income_assets",
            "0029_assetclosedoperation_irpf_normalized_total_bought_and_more",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="assetreadmodel",
            name="irpf_avg_price",
            field=models.DecimalField(decimal_places=8, default=Decimal("0"), max_digits=15),
        ),
    ]
