import sqlite3

from pydrive2.auth import GoogleAuth
from pydrive2.drive import GoogleDrive


def backup_db(gdrive_folder_id: str | None = None) -> None:
    src = sqlite3.connect("db.sqlite3")
    dst = sqlite3.connect("backup.sqlite3")
    with dst:
        src.backup(dst)
    dst.close()
    src.close()

    if gdrive_folder_id:
        _send_to_gdrive(backup_name="backup.sqlite3", folder_id=gdrive_folder_id)


def _send_to_gdrive(backup_name: str, folder_id: str) -> None:
    gauth = GoogleAuth()
    gauth.LocalWebserverAuth()
    drive = GoogleDrive(gauth)

    file1 = drive.CreateFile({"title": backup_name, "parents": [{"id": folder_id}]})
    file1.SetContentFile(backup_name)
    file1.Upload()
