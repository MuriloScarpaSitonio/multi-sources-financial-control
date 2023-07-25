import sqlite3

import requests
from django.conf import settings
from pydrive2.auth import GoogleAuth
from pydrive2.drive import GoogleDrive

from authentication.models import CustomUser


def backup_sqlite_db(gdrive_folder_id: str | None = None) -> None:
    src = sqlite3.connect("db.sqlite3")
    dst = sqlite3.connect("backup.sqlite3")
    with dst:
        src.backup(dst)
    dst.close()
    src.close()

    if gdrive_folder_id:
        _send_to_gdrive(backup_name="backup.sqlite3", folder_id=gdrive_folder_id)


def backup_revenues_db(gdrive_folder_id: str | None = None) -> None:
    revenues = []
    for user_id in CustomUser.objects.values_list("pk", flat=True):
        r = requests.get(
            url=settings.REVENUES_API_URL + "revenues",
            headers={"user-id": str(user_id), "x-key": settings.REVENUES_API_SECRET_KEY},
            params={"size": 100},
            timeout=60,
        )
        revenues += r.json()["items"]
    import json

    with open("revenues.json", "w") as outfile:
        json.dump(revenues, outfile, ensure_ascii=False)

    if gdrive_folder_id:
        _send_to_gdrive(backup_name="revenues.json", folder_id=gdrive_folder_id)


def _send_to_gdrive(backup_name: str, folder_id: str) -> None:
    gauth = GoogleAuth()
    gauth.LocalWebserverAuth()
    drive = GoogleDrive(gauth)

    file1 = drive.CreateFile({"title": backup_name, "parents": [{"id": folder_id}]})
    file1.SetContentFile(backup_name)
    file1.Upload()
