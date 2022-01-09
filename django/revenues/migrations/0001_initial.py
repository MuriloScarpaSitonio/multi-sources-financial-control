# Generated by Django 3.2.5 on 2021-10-24 23:04

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import shared.models_utils


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Revenue',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('value', models.DecimalField(decimal_places=2, max_digits=6)),
                ('description', models.CharField(max_length=300)),
                ('created_at', models.DateField(default=shared.models_utils.serializable_today_function)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='revenues', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]