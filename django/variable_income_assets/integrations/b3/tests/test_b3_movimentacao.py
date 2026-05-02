from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from openpyxl import Workbook

from ..movimentacao import parse_movements
from ..parser import B3ParserError
from ..schemas import B3FixedIncomeAction, B3FixedIncomeKind

HEADER = [
    "Entrada/Saída",
    "Data",
    "Movimentação",
    "Produto",
    "Instituição",
    "Quantidade",
    "Preço unitário",
    "Valor da Operação",
]

INSTITUICAO = "INTER DISTRIBUIDORA DE TITULOS E VALORES MOBILIARIOS LTDA"

CDB_BUY_ROW = [
    "Credito",
    "29/04/2026",
    "COMPRA / VENDA",
    "CDB - CDB426DGCVL",
    INSTITUICAO,
    10,
    1000,
    10000,
]

LCI_BUY_ROW = [
    "Credito",
    "30/12/2024",
    "COMPRA / VENDA",
    "LCI - 24L03571458",
    INSTITUICAO,
    1350000,
    "0.01",
    13500,
]

NON_RENDA_FIXA_ROW = [
    "Credito",
    "30/04/2026",
    "Direito de Subscrição",
    "BTLG12 - BTG PACTUAL LOGISTICA FUNDO DE INVESTIMENTO IMOBILIARIO",
    INSTITUICAO,
    209,
    "-",
    "-",
]

NON_BUY_SELL_ROW = [
    "Credito",
    "29/04/2026",
    "Atualização",
    "CDB - CDB426DGCVL",
    INSTITUICAO,
    10,
    "-",
    "-",
]


def build_xlsx(path: Path, rows: list[list], *, sheet_name: str = "Movimentação", header=HEADER) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    ws.append(header)
    for row in rows:
        ws.append(row)
    wb.save(path)
    return path


def test_happy_path_parses_renda_fixa_buy_row(tmp_path):
    path = build_xlsx(tmp_path / "movimentacao.xlsx", [CDB_BUY_ROW])

    movements = parse_movements(str(path))

    assert len(movements) == 1
    m = movements[0]
    assert m.kind == B3FixedIncomeKind.CDB
    assert m.code == "CDB426DGCVL"
    assert m.action == B3FixedIncomeAction.BUY
    assert m.operation_date == date(2026, 4, 29)
    assert m.quantity == Decimal("10")
    assert m.unit_price == Decimal("1000")


def test_non_renda_fixa_rows_are_filtered_out(tmp_path):
    path = build_xlsx(tmp_path / "movimentacao.xlsx", [NON_RENDA_FIXA_ROW, CDB_BUY_ROW])

    movements = parse_movements(str(path))

    assert len(movements) == 1
    assert movements[0].code == "CDB426DGCVL"


def test_non_buy_sell_movements_are_filtered_out(tmp_path):
    path = build_xlsx(tmp_path / "movimentacao.xlsx", [NON_BUY_SELL_ROW, CDB_BUY_ROW])

    movements = parse_movements(str(path))

    assert len(movements) == 1
    assert movements[0].operation_date == date(2026, 4, 29)


def test_debito_maps_to_sell(tmp_path):
    sell_row = list(CDB_BUY_ROW)
    sell_row[0] = "Debito"
    path = build_xlsx(tmp_path / "movimentacao.xlsx", [sell_row])

    movements = parse_movements(str(path))

    assert movements[0].action == B3FixedIncomeAction.SELL


def test_unknown_flow_raises(tmp_path):
    bad_row = list(CDB_BUY_ROW)
    bad_row[0] = "Garbage"
    path = build_xlsx(tmp_path / "movimentacao.xlsx", [bad_row])

    with pytest.raises(B3ParserError, match="Garbage"):
        parse_movements(str(path))


def test_blank_rows_are_skipped(tmp_path):
    blank = ["", "", "", "", "", "", "", ""]
    path = build_xlsx(tmp_path / "movimentacao.xlsx", [blank, CDB_BUY_ROW])

    movements = parse_movements(str(path))

    assert len(movements) == 1


def test_missing_sheet_raises(tmp_path):
    path = build_xlsx(tmp_path / "movimentacao.xlsx", [CDB_BUY_ROW], sheet_name="Other")

    with pytest.raises(B3ParserError):
        parse_movements(str(path))


def test_missing_required_header_raises(tmp_path):
    bad_header = [h for h in HEADER if h != "Quantidade"]
    bad_row = [c for h, c in zip(HEADER, CDB_BUY_ROW) if h != "Quantidade"]
    path = build_xlsx(tmp_path / "movimentacao.xlsx", [bad_row], header=bad_header)

    with pytest.raises(B3ParserError, match="Quantidade"):
        parse_movements(str(path))


def test_lci_row_parses(tmp_path):
    path = build_xlsx(tmp_path / "movimentacao.xlsx", [LCI_BUY_ROW])

    movements = parse_movements(str(path))

    assert movements[0].kind == B3FixedIncomeKind.LCI
    assert movements[0].code == "24L03571458"
    assert movements[0].unit_price == Decimal("0.01")
