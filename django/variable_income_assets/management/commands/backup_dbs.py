from config.scripts import backup_revenues_db, backup_sqlite_db

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    def handle(self, *_, **__):
        backup_sqlite_db(gdrive_folder_id=settings.GDRIVE_BACKUP_DB_FOLDER_ID)
        backup_revenues_db(gdrive_folder_id=settings.GDRIVE_BACKUP_DB_FOLDER_ID)
