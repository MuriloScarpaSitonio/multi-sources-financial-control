# Generated by Django 3.2.5 on 2021-09-27 23:59

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0001_initial'),
        ('variable_income_assets', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='passiveincome',
            name='fetched_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='incomes', to='tasks.taskhistory'),
        ),
        migrations.AddField(
            model_name='transaction',
            name='fetched_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transactions', to='tasks.taskhistory'),
        ),
    ]
