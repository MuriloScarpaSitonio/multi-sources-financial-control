import json
import sqlite3
from collections.abc import Iterable

from django.conf import settings

import requests
from pydrive2.auth import GoogleAuth
from pydrive2.drive import GoogleDrive

from authentication.models import CustomUser


def backup_sqlite_db(file_name: str = "backup.sqlite3") -> None:
    src = sqlite3.connect("db.sqlite3")
    dst = sqlite3.connect(file_name)
    with dst:
        src.backup(dst)
    dst.close()
    src.close()


def backup_revenues_db(file_name: str = "revenues.json") -> None:
    revenues = []
    for user_id in CustomUser.objects.values_list("pk", flat=True):
        r = requests.get(
            url=settings.REVENUES_API_URL + "revenues",
            headers={"user-id": str(user_id), "x-key": settings.REVENUES_API_SECRET_KEY},
            params={"size": 100},
            timeout=60,
        )
        revenues += r.json()["items"]

    with open(file_name, "w") as outfile:
        json.dump(revenues, outfile, ensure_ascii=False)


def send_to_gdrive(backup_names: Iterable[str], folder_id: str) -> None:
    gauth = GoogleAuth()
    gauth.LocalWebserverAuth()
    drive = GoogleDrive(gauth)

    for backup_name in backup_names:
        file1 = drive.CreateFile({"title": backup_name, "parents": [{"id": folder_id}]})
        file1.SetContentFile(backup_name)
        file1.Upload()
