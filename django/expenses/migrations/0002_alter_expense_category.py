# Generated by Django 3.2.5 on 2021-10-29 01:24

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='expense',
            name='category',
            field=models.CharField(choices=[('RECREATION', 'Lazer'), ('SUPERMARKET', 'Supermercado'), ('FOOD', 'Alimentação'), ('CLOTHES', 'Roupas'), ('GIFT', 'Presentes'), ('HEALTHCARE', 'Saúde'), ('HOUSE', 'Casa'), ('TRANSPORT', 'Transporte'), ('TRIP', 'Viagem'), ('CNPJ', 'CNPJ'), ('OTHER', 'Outros')], max_length=20),
        ),
    ]