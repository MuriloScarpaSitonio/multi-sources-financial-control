# Generated by Django 3.2.5 on 2021-10-07 18:37

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0003_auto_20211006_2256'),
    ]

    operations = [
        migrations.AddField(
            model_name='taskhistory',
            name='error',
            field=models.TextField(blank=True),
        ),
    ]
