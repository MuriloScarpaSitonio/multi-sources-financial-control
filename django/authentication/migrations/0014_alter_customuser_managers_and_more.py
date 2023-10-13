# Generated by Django 4.2.3 on 2023-10-10 00:09

import authentication.managers
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0013_alter_customuser_options_and_more"),
    ]

    operations = [
        migrations.AlterModelManagers(
            name="customuser",
            managers=[
                ("objects", authentication.managers.CustomUserManager()),
            ],
        ),
        migrations.AddField(
            model_name="customuser",
            name="stripe_subscription_updated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
