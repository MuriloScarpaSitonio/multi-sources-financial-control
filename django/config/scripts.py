import sqlite3
from collections.abc import Iterable

from pydrive2.auth import GoogleAuth
from pydrive2.drive import GoogleDrive


def backup_sqlite_db(file_name: str = "backup.sqlite3") -> None:
    src = sqlite3.connect("db.sqlite3")
    dst = sqlite3.connect(file_name)
    with dst:
        src.backup(dst)
    dst.close()
    src.close()


def send_to_gdrive(backup_names: Iterable[str], folder_id: str) -> None:
    gauth = GoogleAuth()
    gauth.LocalWebserverAuth()
    drive = GoogleDrive(gauth)

    for backup_name in backup_names:
        file1 = drive.CreateFile({"title": backup_name, "parents": [{"id": folder_id}]})
        file1.SetContentFile(backup_name)
        file1.Upload()
