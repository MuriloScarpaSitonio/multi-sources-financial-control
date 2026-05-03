from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from openpyxl import Workbook

from ..parser import B3ParserError, parse_positions
from ..schemas import B3FixedIncomeKind

HEADER = [
    "Produto",
    "Instituição",
    "Emissor",
    "Código",
    "Indexador",
    "Tipo de regime",
    "Data de Emissão",
    "Vencimento",
    "Quantidade",
    "Quantidade Disponível",
    "Quantidade Indisponível",
    "Motivo",
    "Contraparte",
    "Preço Atualizado MTM",
    "Valor Atualizado MTM",
    "Preço Atualizado CURVA",
    "Valor Atualizado CURVA",
    "Preço Atualizado FECHAMENTO",
    "Valor Atualizado FECHAMENTO",
]

CDB_ROW = [
    "CDB - BANCO BMG S/A",
    "INTER DISTRIBUIDORA DE TITULOS E VALORES MOBILIARIOS LTDA",
    "BANCO BMG S/A",
    "CDB426DGCVL",
    "PREFIXADO",
    "DEPOSITADO",
    "29/04/2026",
    "30/04/2029",
    "10",
    "10",
    "-",
    "-",
    "-",
    "-",
    "-",
    "1000",
    "10000",
    "-",
    "-",
]

LCI_ROW = [
    "LCI - BANCO INTER S/A",
    "BANCO INTER S/A",
    "BANCO INTER S/A",
    "24L03571458",
    "-",
    "REGISTRADO",
    "30/12/2024",
    "15/12/2027",
    "1350000",
    "1350000",
    "-",
    "-",
    "-",
    "-",
    "-",
    "0.01192499",
    "16098.73",
    "-",
    "-",
]

LIG_ROW = [
    "LIG - BANCO INTER S/A",
    "INTER DISTRIBUIDORA DE TITULOS E VALORES MOBILIARIOS LTDA",
    "BANCO INTER S/A",
    "LIG02500SUX",
    "DI",
    "DEPOSITADO",
    "19/11/2025",
    "19/11/2027",
    "1974273",
    "1974273",
    "-",
    "-",
    "-",
    "-",
    "-",
    "0.01052939",
    "20787.89",
    "-",
    "-",
]


def build_xlsx(path: Path, rows: list[list], *, sheet_name: str = "Renda Fixa", header=HEADER, with_footer: bool = True) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    ws.append(header)
    for row in rows:
        ws.append(row)
    if with_footer:
        ws.append([None] * len(header))
        footer = [None] * len(header)
        if "Valor Atualizado CURVA" in header:
            footer[header.index("Valor Atualizado CURVA")] = "Total"
        ws.append(footer)
        total_row = [None] * len(header)
        if "Valor Atualizado CURVA" in header:
            total_row[header.index("Valor Atualizado CURVA")] = "46886.72"
        ws.append(total_row)
    wb.save(path)
    return path


def test_happy_path_parses_cdb_lci_lig(tmp_path):
    path = build_xlsx(tmp_path / "posicao-test.xlsx", [CDB_ROW, LCI_ROW, LIG_ROW])

    positions = parse_positions(str(path))

    assert len(positions) == 3

    cdb, lci, lig = positions

    assert cdb.kind == B3FixedIncomeKind.CDB
    assert cdb.description == "CDB - BANCO BMG S/A"
    assert cdb.issuer == "BANCO BMG S/A"
    assert cdb.code == "CDB426DGCVL"
    assert cdb.indexer == "PREFIXADO"
    assert cdb.issue_date == date(2026, 4, 29)
    assert cdb.maturity_date == date(2029, 4, 30)
    assert cdb.quantity == Decimal("10")
    assert cdb.current_price == Decimal("1000")

    assert lci.kind == B3FixedIncomeKind.LCI
    assert lci.indexer is None  # '-' becomes None
    assert lci.issue_date == date(2024, 12, 30)
    assert lci.maturity_date == date(2027, 12, 15)
    assert lci.quantity == Decimal("1350000")
    assert lci.current_price == Decimal("0.01192499")

    assert lig.kind == B3FixedIncomeKind.LIG
    assert lig.code == "LIG02500SUX"
    assert lig.indexer == "DI"
    assert lig.current_price == Decimal("0.01052939")


def test_unknown_prefix_maps_to_other(tmp_path):
    row = list(CDB_ROW)
    row[0] = "DEBENTURE - PETROBRAS"
    path = build_xlsx(tmp_path / "posicao-other.xlsx", [row])

    positions = parse_positions(str(path))

    assert len(positions) == 1
    assert positions[0].kind == B3FixedIncomeKind.OTHER
    assert positions[0].description == "DEBENTURE - PETROBRAS"


def test_dash_in_optional_columns_becomes_none(tmp_path):
    row = list(LCI_ROW)
    path = build_xlsx(tmp_path / "posicao-dash.xlsx", [row])

    positions = parse_positions(str(path))

    assert positions[0].indexer is None  # '-' in Indexador


def test_dash_in_required_quantity_raises(tmp_path):
    row = list(CDB_ROW)
    row[HEADER.index("Quantidade")] = "-"
    path = build_xlsx(tmp_path / "posicao-bad-qty.xlsx", [row])

    with pytest.raises(B3ParserError):
        parse_positions(str(path))


def test_footer_and_blank_separator_rows_are_skipped(tmp_path):
    path = build_xlsx(tmp_path / "posicao-footer.xlsx", [CDB_ROW], with_footer=True)

    positions = parse_positions(str(path))

    assert len(positions) == 1


def test_missing_renda_fixa_sheet_raises(tmp_path):
    path = build_xlsx(
        tmp_path / "posicao-no-sheet.xlsx", [CDB_ROW], sheet_name="Acoes", with_footer=False
    )

    with pytest.raises(B3ParserError):
        parse_positions(str(path))


def test_missing_required_header_raises(tmp_path):
    bad_header = [h for h in HEADER if h != "Quantidade"]
    bad_row = [c for h, c in zip(HEADER, CDB_ROW) if h != "Quantidade"]
    path = build_xlsx(
        tmp_path / "posicao-bad-header.xlsx", [bad_row], header=bad_header, with_footer=False
    )

    with pytest.raises(B3ParserError, match="Quantidade"):
        parse_positions(str(path))


def test_newest_file_wins_when_path_is_none(tmp_path, monkeypatch):
    older = tmp_path / "posicao-older.xlsx"
    newer = tmp_path / "posicao-newer.xlsx"

    older_row = list(CDB_ROW)
    older_row[0] = "CDB - OLD BANK"
    build_xlsx(older, [older_row])

    newer_row = list(CDB_ROW)
    newer_row[0] = "CDB - NEW BANK"
    build_xlsx(newer, [newer_row])

    import os as _os

    older_mtime = newer.stat().st_mtime - 100
    _os.utime(older, (older_mtime, older_mtime))

    from .. import parser as parser_mod

    monkeypatch.setattr(parser_mod, "PROJECT_ROOT", tmp_path)

    positions = parse_positions()

    assert len(positions) == 1
    assert positions[0].description == "CDB - NEW BANK"


def test_no_matching_glob_raises(tmp_path, monkeypatch):
    from .. import parser as parser_mod

    monkeypatch.setattr(parser_mod, "PROJECT_ROOT", tmp_path)

    with pytest.raises(B3ParserError, match="no posicao-"):
        parse_positions()
