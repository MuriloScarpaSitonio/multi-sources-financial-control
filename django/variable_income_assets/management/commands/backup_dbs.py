from django.conf import settings
from django.core.management.base import BaseCommand

from config.scripts import backup_revenues_db, backup_sqlite_db, send_to_gdrive


class Command(BaseCommand):
    def handle(self, *_, **__):
        backup_sqlite_db(file_name="backup.sqlite3")
        backup_revenues_db(file_name="revenues.json")
        send_to_gdrive(
            backup_names=("backup.sqlite3", "revenues.json"),
            folder_id=settings.GDRIVE_BACKUP_DB_FOLDER_ID,
        )
