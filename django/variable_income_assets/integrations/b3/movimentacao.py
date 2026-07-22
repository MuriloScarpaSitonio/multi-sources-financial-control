from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from ._workbook import WorkbookSource, open_workbook
from .parser import PROJECT_ROOT, B3ParserError
from .schemas import B3FixedIncomeAction, B3FixedIncomeKind, B3FixedIncomeMovement

SHEET_NAME = "Movimentação"
GLOB_PATTERN = "movimentacao-*.xlsx"
BUY_SELL_LABEL = "COMPRA / VENDA"
RENDA_FIXA_PREFIXES = (B3FixedIncomeKind.CDB, B3FixedIncomeKind.LCI, B3FixedIncomeKind.LIG)
ACTION_BY_FLOW = {"Credito": B3FixedIncomeAction.BUY, "Debito": B3FixedIncomeAction.SELL}

REQUIRED_HEADERS = (
    "Entrada/Saída",
    "Data",
    "Movimentação",
    "Produto",
    "Quantidade",
    "Preço unitário",
)


def _resolve_path(source: WorkbookSource | None) -> WorkbookSource:
    if isinstance(source, bytes):
        return source
    if source is not None:
        return Path(source)

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


def _split_produto(produto: str) -> tuple[B3FixedIncomeKind, str] | None:
    parts = produto.split(" - ", 2)
    if len(parts) < 2:
        return None
    prefix, code = parts[0].strip().upper(), parts[1].strip()
    try:
        kind = B3FixedIncomeKind(prefix)
    except ValueError:
        return None
    if kind not in RENDA_FIXA_PREFIXES:
        return None
    return kind, code


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


def parse_movements(path: WorkbookSource | None = None) -> list[B3FixedIncomeMovement]:
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

        h = _build_header_index(header_row)
        movements: list[B3FixedIncomeMovement] = []

        for row_index, row in enumerate(rows, start=2):
            produto_raw = row[h["Produto"]] if h["Produto"] < len(row) else None
            if _is_blank(produto_raw):
                continue

            movement_label = row[h["Movimentação"]] if h["Movimentação"] < len(row) else None
            if str(movement_label or "").strip() != BUY_SELL_LABEL:
                continue

            split = _split_produto(str(produto_raw).strip())
            if split is None:
                continue
            kind, code = split

            flow = _to_required_str(row[h["Entrada/Saída"]], column="Entrada/Saída", row_index=row_index)
            action = ACTION_BY_FLOW.get(flow)
            if action is None:
                raise B3ParserError(
                    f"row {row_index}: unexpected Entrada/Saída value {flow!r}"
                )

            movements.append(
                B3FixedIncomeMovement(
                    kind=kind,
                    code=code,
                    action=action,
                    operation_date=_to_required_date(
                        row[h["Data"]], column="Data", row_index=row_index
                    ),
                    quantity=_to_required_decimal(
                        row[h["Quantidade"]], column="Quantidade", row_index=row_index
                    ),
                    unit_price=_to_required_decimal(
                        row[h["Preço unitário"]], column="Preço unitário", row_index=row_index
                    ),
                )
            )

        return movements
    finally:
        workbook.close()
