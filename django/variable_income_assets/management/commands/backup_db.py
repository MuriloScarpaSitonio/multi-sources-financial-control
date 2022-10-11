from django.conf import settings
from django.core.management.base import BaseCommand

from config.scripts import backup_db


class Command(BaseCommand):
    def handle(self, *_, **__):
        backup_db(gdrive_folder_id=settings.GDRIVE_BACKUP_DB_FOLDER_ID)
