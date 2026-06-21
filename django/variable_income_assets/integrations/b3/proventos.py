from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from ._workbook import WorkbookSource, open_workbook
from .parser import PROJECT_ROOT, B3ParserError
from .schemas import B3Provento, B3ProventoType

PROVENTOS_SHEET = "Proventos Recebidos"
PROVENTOS_GLOB_PATTERN = "proventos-*.xlsx"

REQUIRED_HEADERS = (
    "Produto",
    "Pagamento",
    "Tipo de Evento",
    "Valor líquido",
)

# B3 "Tipo de Evento" -> normalized kind. Maps 1:1 to PassiveIncomeTypes downstream.
EVENT_LABELS = {
    "Dividendo": B3ProventoType.DIVIDENDO,
    "Juros Sobre Capital Próprio": B3ProventoType.JSCP,
    "Rendimento": B3ProventoType.RENDIMENTO,
    "Reembolso": B3ProventoType.REEMBOLSO,
}


def resolve_proventos_path(source: WorkbookSource | None) -> WorkbookSource:
    if isinstance(source, bytes):
        return source
    if source is not None:
        return Path(source)
    candidates = sorted(
        PROJECT_ROOT.glob(PROVENTOS_GLOB_PATTERN),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise B3ParserError(f"no {PROVENTOS_GLOB_PATTERN} found in {PROJECT_ROOT}")
    return candidates[0]


def _is_blank(value) -> bool:
    if value is None:
        return True
    return bool(isinstance(value, str) and value.strip() in ("", "-"))


def _to_required_str(value, *, column: str, row_index: int) -> str:
    if _is_blank(value):
        raise B3ParserError(f"row {row_index}: required column {column!r} is blank")
    return str(value).strip()


def _to_required_date(value, *, column: str, row_index: int) -> date:
    if _is_blank(value):
        raise B3ParserError(f"row {row_index}: required column {column!r} is blank")
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value).strip(), "%d/%m/%Y").date()
    except ValueError as exc:
        raise B3ParserError(
            f"row {row_index}: could not parse date in {column!r}: {value!r}"
        ) from exc


def _to_required_decimal(value, *, column: str, row_index: int) -> Decimal:
    if _is_blank(value):
        raise B3ParserError(f"row {row_index}: required column {column!r} is blank")
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as exc:
        raise B3ParserError(
            f"row {row_index}: could not parse decimal in {column!r}: {value!r}"
        ) from exc


def _build_header_index(header_row: tuple, *, required: tuple[str, ...]) -> dict[str, int]:
    index: dict[str, int] = {}
    for i, cell in enumerate(header_row):
        if cell is None:
            continue
        index[str(cell).strip()] = i

    for header in required:
        if header not in index:
            raise B3ParserError(f"missing column: {header}")

    return index


def _code_from_produto(produto: str) -> str:
    # "BBAS3 - BANCO DO BRASIL S/A" -> "BBAS3"
    return produto.split(" - ", 1)[0].strip()


def parse_proventos(path: WorkbookSource) -> list[B3Provento]:
    workbook = open_workbook(path)
    try:
        if PROVENTOS_SHEET not in workbook.sheetnames:
            raise B3ParserError(f"sheet {PROVENTOS_SHEET!r} not found")

        sheet = workbook[PROVENTOS_SHEET]
        rows = sheet.iter_rows(values_only=True)

        try:
            header_row = next(rows)
        except StopIteration as exc:
            raise B3ParserError(f"empty sheet {PROVENTOS_SHEET!r}") from exc

        h = _build_header_index(header_row, required=REQUIRED_HEADERS)
        proventos: list[B3Provento] = []

        for row_index, row in enumerate(rows, start=2):
            produto = row[h["Produto"]] if h["Produto"] < len(row) else None
            if _is_blank(produto):
                continue  # blank separator + the trailing "Total" row

            label = str(row[h["Tipo de Evento"]] or "").strip()
            kind = EVENT_LABELS.get(label)
            if kind is None:
                raise B3ParserError(
                    f"row {row_index}: unexpected Tipo de Evento {label!r}"
                )

            proventos.append(
                B3Provento(
                    code=_code_from_produto(
                        _to_required_str(produto, column="Produto", row_index=row_index)
                    ),
                    kind=kind,
                    payment_date=_to_required_date(
                        row[h["Pagamento"]], column="Pagamento", row_index=row_index
                    ),
                    amount=_to_required_decimal(
                        row[h["Valor líquido"]], column="Valor líquido", row_index=row_index
                    ),
                )
            )

        return proventos
    finally:
        workbook.close()
