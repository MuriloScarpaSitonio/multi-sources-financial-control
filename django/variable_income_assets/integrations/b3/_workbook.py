from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import IO

from openpyxl import Workbook, load_workbook

# A workbook can be referenced by a filesystem path or carried in memory as raw
# bytes (an uploaded file read into memory). Bytes are wrapped in a fresh BytesIO
# on every call, so the same payload can be parsed more than once.
WorkbookSource = str | Path | bytes | IO[bytes]


def open_workbook(source: WorkbookSource) -> Workbook:
    if isinstance(source, bytes):
        source = BytesIO(source)
    return load_workbook(source, data_only=True)
