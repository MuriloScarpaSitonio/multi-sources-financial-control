from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.hashers import make_password

from .validators import validate_cpf


class CustomUser(AbstractUser):
    cpf = models.CharField(max_length=14, validators=[validate_cpf])
    cei_password = models.CharField(max_length=128)

    # REQUIRED_FIELDS = ["cpf", "cei_password"]

    def save(self, *args, **kwargs):
        # self.cei_password = make_password(self.cei_password)
        super().save(*args, **kwargs)
