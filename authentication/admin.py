from authentication.models import CustomUser
from django.contrib import admin

from .models import CustomUser

admin.site.register(CustomUser)
