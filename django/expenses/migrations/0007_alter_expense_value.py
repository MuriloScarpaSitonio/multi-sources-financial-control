# Generated by Django 4.2.3 on 2023-08-31 17:38

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("expenses", "0006_rename_price_expense_value_revenue"),
    ]

    operations = [
        migrations.AlterField(
            model_name="expense",
            name="value",
            field=models.DecimalField(decimal_places=2, max_digits=18),
        ),
    ]