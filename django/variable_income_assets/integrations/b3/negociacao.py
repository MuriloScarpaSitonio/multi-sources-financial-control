from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from ._workbook import WorkbookSource, open_workbook
from .parser import PROJECT_ROOT, B3ParserError
from .schemas import B3FixedIncomeAction, B3StockNegotiation, B3StockPosition

ACOES_SHEET = "Acoes"
FII_SHEET = "Fundo de Investimento"
NEGOCIACAO_SHEET = "Negociação"
NEGOCIACAO_GLOB_PATTERN = "negociacao-*.xlsx"

POSICAO_REQUIRED_HEADERS = (
    "Produto",
    "Código de Negociação",
    "Tipo",
    "Quantidade",
    "Preço de Fechamento",
    "Valor Atualizado",
)

COMPRA_VENDA_LABELS = {
    "Compra": B3FixedIncomeAction.BUY,
    "Venda": B3FixedIncomeAction.SELL,
}

NEGOCIACAO_REQUIRED_HEADERS = (
    "Data do Negócio",
    "Tipo de Movimentação",
    "Código de Negociação",
    "Quantidade",
    "Preço",
)


def resolve_negociacao_path(source: WorkbookSource | None) -> WorkbookSource:
    if isinstance(source, bytes):
        return source
    if source is not None:
        return Path(source)
    candidates = sorted(
        PROJECT_ROOT.glob(NEGOCIACAO_GLOB_PATTERN),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise B3ParserError(f"no {NEGOCIACAO_GLOB_PATTERN} found in {PROJECT_ROOT}")
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


def _to_optional_decimal(value) -> Decimal | None:
    if _is_blank(value):
        return None
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None


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


def _parse_positions_sheet(
    path: WorkbookSource, *, sheet_name: str, asset_type: str
) -> list[B3StockPosition]:
    workbook = open_workbook(path)
    try:
        if sheet_name not in workbook.sheetnames:
            raise B3ParserError(f"sheet {sheet_name!r} not found")

        sheet = workbook[sheet_name]
        rows = sheet.iter_rows(values_only=True)
        try:
            header_row = next(rows)
        except StopIteration as exc:
            raise B3ParserError(f"empty sheet {sheet_name!r}") from exc

        h = _build_header_index(header_row, required=POSICAO_REQUIRED_HEADERS)
        positions: list[B3StockPosition] = []
        for row_index, row in enumerate(rows, start=2):
            produto = row[h["Produto"]] if h["Produto"] < len(row) else None
            if _is_blank(produto):
                continue

            positions.append(
                B3StockPosition(
                    type=asset_type,
                    code=_to_required_str(
                        row[h["Código de Negociação"]],
                        column="Código de Negociação",
                        row_index=row_index,
                    ),
                    description=_to_required_str(
                        produto, column="Produto", row_index=row_index
                    ),
                    tipo=_to_optional_str(row[h["Tipo"]]),
                    quantity=_to_required_decimal(
                        row[h["Quantidade"]], column="Quantidade", row_index=row_index
                    ),
                    closing_price=_to_optional_decimal(row[h["Preço de Fechamento"]]),
                    current_value=_to_optional_decimal(row[h["Valor Atualizado"]]),
                )
            )
        return positions
    finally:
        workbook.close()


def parse_stock_positions(path: WorkbookSource, *, asset_type: str) -> list[B3StockPosition]:
    return _parse_positions_sheet(path, sheet_name=ACOES_SHEET, asset_type=asset_type)


def parse_fii_positions(path: WorkbookSource, *, asset_type: str) -> list[B3StockPosition]:
    return _parse_positions_sheet(path, sheet_name=FII_SHEET, asset_type=asset_type)


def parse_negotiations(path: WorkbookSource) -> list[B3StockNegotiation]:
    workbook = open_workbook(path)
    try:
        if NEGOCIACAO_SHEET not in workbook.sheetnames:
            raise B3ParserError(f"sheet {NEGOCIACAO_SHEET!r} not found")

        sheet = workbook[NEGOCIACAO_SHEET]
        rows = sheet.iter_rows(values_only=True)

        try:
            header_row = next(rows)
        except StopIteration as exc:
            raise B3ParserError(f"empty sheet {NEGOCIACAO_SHEET!r}") from exc

        h = _build_header_index(header_row, required=NEGOCIACAO_REQUIRED_HEADERS)
        negotiations: list[B3StockNegotiation] = []

        for row_index, row in enumerate(rows, start=2):
            code_raw = (
                row[h["Código de Negociação"]] if h["Código de Negociação"] < len(row) else None
            )
            if _is_blank(code_raw):
                continue

            label = str(row[h["Tipo de Movimentação"]] or "").strip()
            action = COMPRA_VENDA_LABELS.get(label)
            if action is None:
                continue

            negotiations.append(
                B3StockNegotiation(
                    code=_to_required_str(
                        code_raw, column="Código de Negociação", row_index=row_index
                    ),
                    action=action,
                    operation_date=_to_required_date(
                        row[h["Data do Negócio"]],
                        column="Data do Negócio",
                        row_index=row_index,
                    ),
                    quantity=_to_required_decimal(
                        row[h["Quantidade"]], column="Quantidade", row_index=row_index
                    ),
                    price=_to_required_decimal(
                        row[h["Preço"]], column="Preço", row_index=row_index
                    ),
                )
            )

        return negotiations
    finally:
        workbook.close()
