# Generated by Django 4.2.3 on 2023-07-30 22:30

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        (
            "authentication",
            "0009_remove_integrationsecret_cei_secrets_all_null_or_all_filled_and_more",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="customuser",
            name="is_active",
            field=models.BooleanField(default=False),
        ),
    ]