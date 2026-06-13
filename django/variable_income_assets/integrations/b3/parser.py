import logging
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from ._workbook import WorkbookSource, open_workbook
from .schemas import B3FixedIncomeKind, B3FixedIncomePosition

logger = logging.getLogger(__name__)

SHEET_NAME = "Renda Fixa"
GLOB_PATTERN = "posicao-*.xlsx"
PROJECT_ROOT = Path(__file__).resolve().parents[3]

REQUIRED_HEADERS = (
    "Produto",
    "Emissor",
    "Código",
    "Indexador",
    "Data de Emissão",
    "Vencimento",
    "Quantidade",
    "Preço Atualizado CURVA",
)


class B3ParserError(Exception):
    pass


def _resolve_path(path: WorkbookSource | None) -> WorkbookSource:
    if isinstance(path, bytes):
        return path
    if path is not None:
        return Path(path)

    candidates = sorted(
        PROJECT_ROOT.glob(GLOB_PATTERN), key=lambda p: p.stat().st_mtime, reverse=True
    )
    if not candidates:
        raise B3ParserError(f"no {GLOB_PATTERN} found in {PROJECT_ROOT}")
    return candidates[0]


def _is_blank(value) -> bool:
    if value is None:
        return True
    return bool(isinstance(value, str) and value.strip() in ("", "-"))


def _to_optional_str(value) -> str | None:
    if _is_blank(value):
        return None
    return str(value).strip()


def _to_required_str(value, *, column: str, row_index: int) -> str:
    if _is_blank(value):
        raise B3ParserError(f"row {row_index}: required column {column!r} is blank")
    return str(value).strip()


def _to_optional_date(value, *, column: str, row_index: int) -> date | None:
    if _is_blank(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value).strip(), "%d/%m/%Y").date()
    except ValueError as exc:
        logger.debug("row %s: could not parse date in %r: %s", row_index, column, exc)
        return None


def _to_optional_decimal(value, *, column: str, row_index: int) -> Decimal | None:
    if _is_blank(value):
        return None
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as exc:
        logger.debug("row %s: could not parse decimal in %r: %s", row_index, column, exc)
        return None


def _to_required_decimal(value, *, column: str, row_index: int) -> Decimal:
    if _is_blank(value):
        raise B3ParserError(f"row {row_index}: required column {column!r} is blank")
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as exc:
        raise B3ParserError(
            f"row {row_index}: could not parse decimal in {column!r}: {value!r}"
        ) from exc


def _derive_kind(description: str) -> B3FixedIncomeKind:
    prefix = description.split(" - ", 1)[0].strip().upper()
    try:
        return B3FixedIncomeKind(prefix)
    except ValueError:
        return B3FixedIncomeKind.OTHER


def _build_header_index(header_row: tuple) -> dict[str, int]:
    index: dict[str, int] = {}
    for i, cell in enumerate(header_row):
        if cell is None:
            continue
        index[str(cell).strip()] = i

    for required in REQUIRED_HEADERS:
        if required not in index:
            raise B3ParserError(f"missing column: {required}")

    return index


def parse_positions(path: WorkbookSource | None = None) -> list[B3FixedIncomePosition]:
    workbook = open_workbook(_resolve_path(path))
    try:
        if SHEET_NAME not in workbook.sheetnames:
            raise B3ParserError(f"sheet {SHEET_NAME!r} not found")

        sheet = workbook[SHEET_NAME]
        rows = sheet.iter_rows(values_only=True)

        try:
            header_row = next(rows)
        except StopIteration as exc:
            raise B3ParserError(f"empty sheet {SHEET_NAME!r}") from exc

        header_index = _build_header_index(header_row)
        positions: list[B3FixedIncomePosition] = []

        for row_index, row in enumerate(rows, start=2):
            produto = row[header_index["Produto"]] if header_index["Produto"] < len(row) else None
            if _is_blank(produto):
                continue

            description = _to_required_str(produto, column="Produto", row_index=row_index)
            quantity = _to_required_decimal(
                row[header_index["Quantidade"]],
                column="Quantidade",
                row_index=row_index,
            )

            positions.append(
                B3FixedIncomePosition(
                    kind=_derive_kind(description),
                    description=description,
                    issuer=_to_optional_str(row[header_index["Emissor"]]),
                    code=_to_optional_str(row[header_index["Código"]]),
                    indexer=_to_optional_str(row[header_index["Indexador"]]),
                    issue_date=_to_optional_date(
                        row[header_index["Data de Emissão"]],
                        column="Data de Emissão",
                        row_index=row_index,
                    ),
                    maturity_date=_to_optional_date(
                        row[header_index["Vencimento"]],
                        column="Vencimento",
                        row_index=row_index,
                    ),
                    quantity=quantity,
                    current_price=_to_optional_decimal(
                        row[header_index["Preço Atualizado CURVA"]],
                        column="Preço Atualizado CURVA",
                        row_index=row_index,
                    ),
                )
            )

        return positions
    finally:
        workbook.close()
