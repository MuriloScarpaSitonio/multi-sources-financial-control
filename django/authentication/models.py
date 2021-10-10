from django.db import models
from django.contrib.auth.models import AbstractUser

from .fields import EncryptedField


class CustomUser(AbstractUser):
    # do not encrypt cpf as it won't be unique
    cpf = models.CharField(max_length=14, null=True, blank=True, unique=True)
    cei_password = EncryptedField(null=True, blank=True)
