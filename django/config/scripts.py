from collections.abc import Iterable

from pydrive2.auth import GoogleAuth
from pydrive2.drive import GoogleDrive


def send_to_gdrive(backup_names: Iterable[str], folder_id: str) -> None:
    gauth = GoogleAuth()
    gauth.LocalWebserverAuth()
    drive = GoogleDrive(gauth)

    for backup_name in backup_names:
        file1 = drive.CreateFile({"title": backup_name, "parents": [{"id": folder_id}]})
        file1.SetContentFile(backup_name)
        file1.Upload()
