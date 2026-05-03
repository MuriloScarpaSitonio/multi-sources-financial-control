from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from openpyxl import Workbook

from ..negociacao import parse_negotiations
from ..parser import B3ParserError
from ..schemas import B3FixedIncomeAction

NEGOCIACAO_HEADER = [
    "Data do Negócio",
    "Tipo de Movimentação",
    "Mercado",
    "Prazo/Vencimento",
    "Instituição",
    "Código de Negociação",
    "Quantidade",
    "Preço",
    "Valor",
]

INSTITUICAO = "INTER DTVM"

BBAS3_BUY = [
    "02/04/2026", "Compra", "Mercado à Vista", "-", INSTITUICAO,
    "BBAS3", 100, 23.39, 2339,
]

ITSA4_SELL = [
    "06/04/2026", "Venda", "Mercado à Vista", "-", INSTITUICAO,
    "ITSA4", 1400, 13.9, 19460,
]

BTLG11_BUY = [
    "02/04/2026", "Compra", "Mercado à Vista", "-", INSTITUICAO,
    "BTLG11", 6, 103.89, 623.34,
]


def _build(tmp_path: Path, rows: list[list], *, header=NEGOCIACAO_HEADER) -> str:
    path = tmp_path / "negociacao.xlsx"
    wb = Workbook()
    ws = wb.active
    ws.title = "Negociação"
    ws.append(header)
    for row in rows:
        ws.append(row)
    wb.save(path)
    return str(path)


def test_happy_path(tmp_path):
    path = _build(tmp_path, [BBAS3_BUY, ITSA4_SELL, BTLG11_BUY])

    negotiations = parse_negotiations(path)

    assert len(negotiations) == 3
    assert negotiations[0].code == "BBAS3"
    assert negotiations[0].action == B3FixedIncomeAction.BUY
    assert negotiations[0].operation_date == date(2026, 4, 2)
    assert negotiations[0].quantity == Decimal("100")
    assert negotiations[0].price == Decimal("23.39")
    assert negotiations[1].action == B3FixedIncomeAction.SELL
    assert negotiations[2].code == "BTLG11"


def test_skips_unknown_movement_label(tmp_path):
    weird = list(BBAS3_BUY)
    weird[1] = "Bonificação"
    path = _build(tmp_path, [weird, BBAS3_BUY])

    negotiations = parse_negotiations(path)

    assert len(negotiations) == 1


def test_missing_required_header_raises(tmp_path):
    bad_header = [h for h in NEGOCIACAO_HEADER if h != "Quantidade"]
    bad_row = [c for h, c in zip(NEGOCIACAO_HEADER, BBAS3_BUY) if h != "Quantidade"]
    path = _build(tmp_path, [bad_row], header=bad_header)

    with pytest.raises(B3ParserError, match="Quantidade"):
        parse_negotiations(path)


def test_missing_sheet_raises(tmp_path):
    path = tmp_path / "x.xlsx"
    wb = Workbook()
    wb.active.title = "Other"
    wb.save(path)

    with pytest.raises(B3ParserError):
        parse_negotiations(str(path))
