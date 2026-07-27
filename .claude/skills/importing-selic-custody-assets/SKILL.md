---
name: importing-selic-custody-assets
description: Use when registering TPF/NTN-B held in Selic custody through a bank — invisible to the B3 import — via a one-off prod-shell script that creates Assets/Transactions from bank statements (OFX, PDF extrato, Selic custody extrato).
---

# Importing Selic Custody Assets (bank-held TPF)

## Overview

Assets held in Selic custody via a bank (e.g. NTN-Bs bought through Inter/XP) never appear in B3 export files, so the B3 import wizard can't see them. The fix is a one-off function in `django/variable_income_assets/scripts.py`, run from a prod Django shell. Precedent: `import_selic_ntnb` in that file.

## Data sources — what to trust

| Source | Gives | Lacks / traps |
|---|---|---|
| Selic "Extrato de custódia" PDF | ISIN per title, total quantity (integer) | No cost, no dates, no prices |
| Bank "Extrato de Movimentação de Renda Fixa" PDF | Buy rows per product block: `Aplicacao` date + total R$; maturity in block header | No ISIN, no quantity, no unit price. PDF text layer puts the product name AFTER its table — parse accordingly |
| Bank OFX export | Nothing usable | **Never import "RENDIMENTO ATÉ ESTA DATA" rows** — they're accrued-value snapshots stamped at the file's `DTEND`, not cash flows; each export re-reports a bigger number. "PREVISÃO DE I.R." rows are projections. No ISIN, only opaque REFNUMs |
| Bank web position table (per-nota) | Nota IDs (usable as `Transaction.external_id`), per-nota gross value | Per-nota "Bruto" ≠ qty × market price (each nota accrues on own curve); only the per-title SUM matches the extrato total |

Join key between sources: **(title type, maturity date)** — e.g. "TPF NTN-B / Vencimento: 15/08/2030" ↔ "NTN-B ... 15/08/2030 BRSTNCNTB3B8".

## Deriving per-buy quantities

No source reports quantity per buy. Enumerate integer splits of the Selic total across the buys; the right one is the split whose implied unit prices (`amount/qty`) are nearly identical (NTN-B PUs move slowly, ~R$4.5k in 2026). Validate `sum(split) == custody total`; if spread > ~5% or ambiguous, ask the user. Unit price = `total_paid / qty` quantized to 8dp (`Transaction.price` is `DecimalField(15, 8)`).

## Script mechanics (copy the precedent, mind these)

- **Create via serializers, not `.objects.create`**: `AssetSerializer` + `TransactionListSerializer` with a fake request context (`{"request": _RequestContext(user)}`) — this fires the messagebus so `AssetMetaData` and the CQRS read models update.
- **`AssetSerializer.save()` returns `AssetDomainModel`, NOT the ORM instance.** It has `.id` only — `asset.pk` raises `AttributeError`. This bug was made independently twice; use `asset.id`.
- Asset payload: `type=AssetTypes.fixed_br`, `code=ISIN`, `currency=Currencies.real`, `liquidity_type` required for fixed_br, dates as `"%d/%m/%Y"` strings, `maturity_date` must be in the future.
- **Metadata price**: the `AssetCreated` handler creates the global row (`asset__isnull=True`) with `current_price=0` (`fetch_asset_current_price` returns `Decimal()` for fixed_br). Set it afterwards — scope the filter with `type`/`currency`/`asset__isnull=True` like `_bulk_fetch_fixed_br_metadata` does. Unit value = gross ("Valor"/"Bruto") extrato total ÷ quantity, 6dp; gross not net-of-IR (no metadata price is tax-discounted).
- **Dry-run pattern**: `dry_run: bool = True` param; wrap in `transaction.atomic()`, raise a private `_Rollback` exception when `dry_run` — same as the B3 import service.
- Portfolio value = `quantity_balance × metadata.current_price`, joined at read time — no read-model resync needed after a price update.

## Aftercare (tell the user)

- Price goes stale: nothing auto-updates fixed_br prices. Refresh with `update_asset_metadata_current_price(code=ISIN, price=...)` from the shell.
- Coupons can't be `PassiveIncome`: `fixed_br` has `accept_incomes=False` in choices.py.
- Running apply twice duplicates transactions unless the script dedupes by `(action, operation_date, quantity, price)`.
