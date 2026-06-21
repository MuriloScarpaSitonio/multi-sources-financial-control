from __future__ import annotations

import zipfile
from datetime import datetime

from django.core.files.uploadedfile import UploadedFile
from django.db import transaction as djtransaction

from openpyxl.utils.exceptions import InvalidFileException
from rest_framework.exceptions import ValidationError as DRFValidationError

from .handlers import (
    B3ImportError,
    import_b3_negociacoes,
    import_b3_proventos,
    import_b3_renda_fixa_positions,
    import_b3_tesouro_positions,
)
from .parser import B3ParserError

# Raised when an upload cannot be parsed/imported — surfaced to the client as a
# 400 attributed to the failing operation. BadZipFile / InvalidFileException
# cover a corrupt or non-xlsx payload reaching openpyxl.
_OPERATION_ERRORS = (B3ParserError, B3ImportError, zipfile.BadZipFile, InvalidFileException)


class B3ImportOperationError(Exception):
    """A single B3 operation failed while parsing/running its files."""

    def __init__(self, *, operation: str, detail: str) -> None:
        self.operation = operation
        self.detail = detail
        super().__init__(f"{operation}: {detail}")

    def as_dict(self) -> dict:
        return {"operation": self.operation, "detail": self.detail}


def _read(uploaded_file: UploadedFile | None) -> bytes | None:
    return uploaded_file.read() if uploaded_file is not None else None


def _format_drf_error(exc: DRFValidationError) -> str:
    # Flatten a DRF/domain ValidationError to a single readable message (drops the
    # field names, which are internal — e.g. "action" for a sell-exceeds-holdings).
    detail = exc.detail
    if isinstance(detail, dict):
        messages: list = []
        for value in detail.values():
            messages.extend(value if isinstance(value, list | tuple) else [value])
        return "; ".join(str(m) for m in messages)
    if isinstance(detail, list | tuple):
        return "; ".join(str(m) for m in detail)
    return str(detail)


def _run_operation(
    operation: str,
    *,
    user_id: int,
    dry_run: bool,
    workbook_dt: datetime | None,
    create_missing_assets: bool,
    negociacao: bytes | None,
    posicao: bytes | None,
    movimentacao: bytes | None,
    proventos: bytes | None,
) -> dict:
    if operation == "negociacoes":
        return import_b3_negociacoes(
            user_id=user_id,
            dry_run=dry_run,
            create_missing_assets=create_missing_assets,
            negociacao_path=negociacao,
            posicao_path=posicao,
        )
    if operation == "proventos":
        return import_b3_proventos(
            user_id=user_id, dry_run=dry_run, proventos_path=proventos
        )
    if operation == "renda_fixa":
        return import_b3_renda_fixa_positions(
            user_id=user_id,
            dry_run=dry_run,
            posicao_path=posicao,
            movimentacao_path=movimentacao,
            workbook_dt=workbook_dt,
        )
    return import_b3_tesouro_positions(
        user_id=user_id,
        dry_run=dry_run,
        posicao_path=posicao,
        movimentacao_path=movimentacao,
        workbook_dt=workbook_dt,
    )


def run_b3_import(
    *,
    user_id: int,
    operations: list[str],
    dry_run: bool,
    workbook_dt: datetime | None,
    create_missing_assets: bool = False,
    negociacao_file: UploadedFile | None,
    posicao_file: UploadedFile | None,
    movimentacao_file: UploadedFile | None,
    proventos_file: UploadedFile | None = None,
) -> dict:
    files = {
        "negociacao": _read(negociacao_file),
        "posicao": _read(posicao_file),
        "movimentacao": _read(movimentacao_file),
        "proventos": _read(proventos_file),
    }

    def run_all() -> dict:
        reports: dict = {}
        for operation in operations:
            try:
                reports[operation] = _run_operation(
                    operation,
                    user_id=user_id,
                    dry_run=dry_run,
                    workbook_dt=workbook_dt,
                    create_missing_assets=create_missing_assets,
                    **files,
                )
            except _OPERATION_ERRORS as exc:
                raise B3ImportOperationError(operation=operation, detail=str(exc)) from exc
            except DRFValidationError as exc:
                # Domain rule violation (e.g. selling more than held) surfaced by a
                # serializer; attribute it to the op so the client gets a clear 400.
                raise B3ImportOperationError(
                    operation=operation, detail=_format_drf_error(exc)
                ) from exc
        return reports

    if dry_run:
        # each handler self-rolls-back; the first op error aborts the whole preview
        return {"dry_run": dry_run, "reports": run_all()}

    with djtransaction.atomic():  # all-or-nothing across ops on apply
        return {"dry_run": dry_run, "reports": run_all()}
