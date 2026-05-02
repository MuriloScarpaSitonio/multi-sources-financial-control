# B3 Fixed-Income Parser — Design

**Date:** 2026-05-01
**Status:** Approved for implementation

## Goal

Parse the user's "Renda Fixa" positions from the xlsx the B3 investor portal exports via its own "Baixar" button on
`/minha-carteira/investimentos/posicao`. Return a `list[B3FixedIncomePosition]` of pydantic models. The caller handles
persistence — this module is purely a reader.

The xlsx is the canonical source. There is no browser automation, no auth, no scraping. The user clicks "Baixar" in
their authenticated browser, lets it land in their Downloads, moves it (or symlinks it) to the Django project root,
and calls `parse_positions()`.

## Out of Scope

- Authentication, session handling, browser drivers — replaced by manual export.
- Sheets other than `Renda Fixa` (the file also contains Acoes / Empréstimos / Fundo de Investimento / Tesouro Direto).
- Persisting to the database, deduping vs. existing records, Django coupling. The scraper imports nothing from Django.
- Discovering the xlsx anywhere other than the Django project root (no `~/Downloads` watching).

## Architecture

Two files under `django/variable_income_assets/integrations/b3/` (sibling to the existing `binance/` and `kucoin/`):

```
django/variable_income_assets/integrations/b3/
    __init__.py
    schemas.py    # B3FixedIncomePosition pydantic model + B3FixedIncomeKind enum
    parser.py     # public parse_positions(...) + xlsx reading helpers
```

Imports nothing from Django. Depends only on `pydantic` (already in the project) and `openpyxl` (user adds to deps).

### Public API

```python
def parse_positions(path: str | None = None) -> list[B3FixedIncomePosition]: ...
```

- `path=None` (default): find the most recent file matching `posicao-*.xlsx` in the Django project root and use that.
- `path` given: parse exactly that file.

The Django project root is located by walking up from `parser.py`'s `__file__` until a directory containing
`manage.py` is found. No hardcoded `/Users/...`. Failure to find `manage.py` raises `B3ParserError`.

If `path is None` and no `posicao-*.xlsx` exists in the project root, raise `B3ParserError("no posicao-*.xlsx found in <root>")`.

### Caller usage

```python
from variable_income_assets.integrations.b3.parser import parse_positions

positions = parse_positions()             # auto-pick newest in django/
positions = parse_positions("foo.xlsx")   # explicit
```

## Data Model

```python
# schemas.py
from datetime import date
from decimal import Decimal
from enum import StrEnum
from pydantic import BaseModel

class B3FixedIncomeKind(StrEnum):
    CDB = "CDB"
    LCI = "LCI"
    LIG = "LIG"
    OTHER = "OTHER"   # any prefix not matching the above

class B3FixedIncomePosition(BaseModel):
    kind: B3FixedIncomeKind        # derived from the prefix of `description`
    description: str               # xlsx "Produto" verbatim, e.g., "CDB - BANCO BMG S/A"
    issuer: str | None             # xlsx "Emissor"
    code: str | None               # xlsx "Código" (the unique identifier)
    indexer: str | None            # xlsx "Indexador" (PREFIXADO / DI / IPCA / ...)
    issue_date: date | None        # xlsx "Data de Emissão"
    quantity: Decimal              # xlsx "Quantidade"
    current_price: Decimal | None  # xlsx "Preço Atualizado CURVA"
```

### Field name decisions (made, not asked)

- `Produto` → `description` (long human-readable label; "Produto" is too generic)
- `Emissor` → `issuer`
- `Código` → `code` (matches the existing `Asset.code` convention in `variable_income_assets`)
- `Indexador` → `indexer`
- `Data de Emissão` → `issue_date`
- `Quantidade` → `quantity`
- `Preço Atualizado CURVA` → `current_price`
- Section/`kind` is a derived enum, parsed from the prefix before " - " in `description`.
  Anything that isn't CDB/LCI/LIG maps to `OTHER` (no exception thrown — the user said no filter).

### Normalization rules

- Cells containing `'-'`, `''`, or `None` → `None` for all `Optional` fields. Required fields (`description`,
  `quantity`) raise `B3ParserError` if blank.
- Dates are `DD/MM/YYYY` strings → `datetime.date`.
- `quantity` and `current_price` accept ints, floats, and numeric strings; converted via `Decimal(str(...))` to
  preserve exact precision.

## Parsing Flow

```
1. Resolve path (passed-in OR newest matching glob in project root).
2. openpyxl.load_workbook(path, data_only=True, read_only=True).
3. Open the "Renda Fixa" sheet. Raise B3ParserError if the sheet is missing.
4. First row is the header. Build a column-name → index map. Required headers
   (raise on missing): Produto, Emissor, Código, Indexador, Data de Emissão,
   Quantidade, Preço Atualizado CURVA.
5. For each subsequent row:
     a. Skip rows where Produto is blank/None (separator + Total footer).
     b. Map cells via the header index, normalize blanks to None,
        coerce dates and Decimals.
     c. Derive kind from description prefix.
     d. Append a B3FixedIncomePosition.
6. Return the list.
```

## Error Handling

- File not found / no glob match → `B3ParserError`.
- Sheet "Renda Fixa" not present → `B3ParserError`.
- Required header missing → `B3ParserError("missing column: <name>")`.
- Required value blank/unparseable in a row → `B3ParserError` with the row index and offending column.
- Optional value blank/unparseable → field becomes `None` (logged at DEBUG, not raised).

A single custom exception class (`B3ParserError`) keeps the surface small.

## Testing

`tests/test_b3_parser.py` next to the module. Every test builds its xlsx fixture **at runtime** with `openpyxl` —
no real B3 export is committed (it contains personal financial data). The fixture builder is a small helper that
takes a list of dicts and writes a workbook with the same shape as the real export (matching headers, the same
"Renda Fixa" sheet, an empty separator row, a `Total` footer).

Cases:

- happy path: one CDB, one LCI, one LIG row → returns 3 items with correct `kind` derivation.
- prefix not matching any known kind → `kind == OTHER`.
- `'-'` in optional columns → `None` in the model.
- `'-'` in `Quantidade` (required) → raises.
- footer + blank-separator rows → skipped silently.
- missing "Renda Fixa" sheet → raises.
- missing required header → raises.
- newest-file picker: write two `posicao-*.xlsx` with different mtimes into a tmp dir
  and confirm the newest wins (use `monkeypatch` to point the project-root finder at tmp).

## Implementation Notes for the Executor

- Use `openpyxl` (the user is adding it to dev deps); no other parsing libs.
- `read_only=True, data_only=True` on `load_workbook` keeps memory low and gets formula-resolved values.
- Walk up from `Path(__file__).resolve()` looking for a directory containing `manage.py`. Cap the walk at 10
  parents to avoid scanning `/`. Cache the result in a module-level `_PROJECT_ROOT` only after first successful
  resolution.
- Module must remain Django-free: no `from django...` anywhere in the package.
- The pydantic model uses `model_config = ConfigDict(frozen=True)` so callers can't mutate parsed rows by accident.
