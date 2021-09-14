from django.contrib import admin

from .models import Asset, PassiveIncome, Transaction

admin.site.register([Asset, PassiveIncome, Transaction])
