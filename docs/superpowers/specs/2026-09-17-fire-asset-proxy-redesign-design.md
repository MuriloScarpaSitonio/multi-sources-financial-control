# FIRE Asset-Proxy Redesign

**Date:** 2026-09-17  
**Status:** Proposed design, awaiting product-owner review  
**Scope:** Asset classification, historical-return proxies, and portfolio inputs used by `/planning/fire` and its age-in-bonds variant

## Purpose

Replace the current three-bucket simplification—IBOV for most risky assets, IFIX for FIIs, and CDI for fixed income plus bank cash—with explicit return categories that reflect materially different assets.

The redesign must keep the simulation understandable and configurable without requiring a proxy choice for every individual asset. Market-proxy choices are made per broad variable-income category; Brazilian fixed-income proxies are derived automatically from each asset's indexer and remaining maturity.

## Decisions

### Variable-income categories

Rename the existing user-facing categories and add a global category:

| Stored asset type | User-facing label | Simulation proxy |
|---|---|---|
| `STOCK` | `Renda variável BR` | IBOV |
| `STOCK_USA` | `Renda variável EUA` | SPY or VTI |
| `EQUITY_GLOBAL` | `Renda variável Global` | VT or VWRL/VWRA family |
| `FII` | `FII` | IFIX |
| `CRYPTO` | `Cripto` | Bitcoin or CMBI 10 |

`EQUITY_GLOBAL` is a new asset type. Existing VT/VWRA-family holdings currently classified as `STOCK_USA` will be reclassified manually through Django shell before the final database constraints are installed.

The persisted defaults are:

- US variable income: SPY
- Global variable income: VT
- Crypto: Bitcoin

The alternatives remain selectable:

- SPY: S&P 500 exposure and longer history; VTI: broader US-market exposure and shorter history.
- VT: global all-cap exposure including small caps; VWRL/VWRA family: large/mid-cap global exposure closer to VWRA holdings, using VWRL's longer available history.
- Bitcoin: single-asset exposure and longer history; CMBI 10: diversified large-crypto basket and shorter history.

These are category-wide selections. There is no proxy selector on each individual variable-income asset.

### Brazilian fixed income

Add a normalized `indexer` field to the canonical `Asset`, its domain representation, and `AssetReadModel`. Supported values are `CDI`, `SELIC`, `IPCA`, and `PREFIXED`.

Reuse the existing `maturity_date`; do not persist a duration or proxy bucket. The backend derives the bucket whenever it builds the FIRE allocation, comparing maturity with `timezone.localdate()`:

| Asset facts | Derived return bucket |
|---|---|
| Indexer `CDI` | CDI |
| Indexer `SELIC` | IMA-S |
| Indexer `PREFIXED`, remaining maturity up to one year | IRF-M 1 |
| Indexer `PREFIXED`, remaining maturity over one year | IRF-M 1+ |
| Indexer `IPCA`, remaining maturity up to five years | IMA-B 5 |
| Indexer `IPCA`, remaining maturity over five years | IMA-B 5+ |

No fixed-income proxy selector is exposed to the user.

Database integrity is enforced on the canonical `Asset` table with `CheckConstraint`s, backed by serializer/domain validation for useful API errors:

- Fixed-income assets require a supported `indexer`.
- IPCA and prefixado assets require `maturity_date`.
- Non-fixed-income assets cannot retain fixed-income classification fields.
- The existing “future maturity on creation” rule remains application validation rather than a time-dependent database constraint.

The B3 fixed-income import already parses indexer and maturity. It must persist and refresh both values. Manually created fixed-income assets retain user-entered values.

### Cash

Bank balances remain part of FIRE patrimony and progress. They are exposed as a separate `CASH` return bucket rather than being added to fixed income.

Cash has zero nominal return. Its monthly real return is therefore:

```text
cash_real_return = 1 / (1 + monthly_ipca) - 1
```

The redesign does not introduce a liquidation-order or rebalancing rule. Contributions and withdrawals retain the aggregate simulation behavior already used by FIRE; only the return assigned to the cash fraction changes.

### Age in bonds

Age in bonds remains an optional constant-dollar FIRE variant. It continues to change the simulated stock/fixed-income allocation path rather than creating a different withdrawal rule.

The richer proxy model preserves the user's relative composition within variable income and within fixed income while the age-based stock/fixed-income split changes. When the user owns no fixed-income assets, IMA-Geral ex-C is the broad Brazilian government-bond fallback for the hypothetical fixed-income sleeve.

IMA-Geral ex-C is added to the same ANBIMA ingestion path as the other IMA indices.

## Django design

### Asset schema

Add `FixedIncomeIndexers` choices and an `indexer` `CharField` to:

- `variable_income_assets.models.write.Asset`
- `variable_income_assets.domain.models.Asset`
- `variable_income_assets.models.read.AssetReadModel`

Add `EQUITY_GLOBAL` to `AssetTypes`, with USD as its initially supported currency. Increase the asset-type field length consistently across write, metadata, and read models where required by the stored value.

Thread `indexer` through commands, events, repositories, serializers, CQRS synchronization, and B3 integration handlers. While doing so, correct `Asset.to_domain()` so it also carries the already-persisted `liquidity_type` and `maturity_date` fields.

### Preferences

Continue storing FIRE configuration in `CustomUser.planning_preferences`, validated by `PlanningPreferencesSerializer`. Add these keys under `planning_preferences["fire"]`:

```json
{
  "sampling_method": "independent_months",
  "us_equity_proxy": "SPY",
  "global_equity_proxy": "VT",
  "crypto_proxy": "BTC",
  "excluded_return_categories": []
}
```

Allowed sampling methods are `independent_months` and `contiguous_12_month_blocks`.

`excluded_return_categories` stores stable domain categories, not selected proxy names or maturity buckets. Supported exclusions are:

- `BR_EQUITY`
- `US_EQUITY`
- `GLOBAL_EQUITY`
- `FII`
- `CRYPTO`
- `FIXED_CDI`
- `FIXED_SELIC`
- `FIXED_PREFIXED`
- `FIXED_IPCA`

The existing `exclude_ifix_from_sim=true` preference is translated to `FII` in this list and then retired.

### FIRE allocation service

Add one backend service that derives the current FIRE allocation from read models and bank accounts. It is the sole owner of asset-to-category and fixed-income-to-bucket classification.

Its API response contains current BRL totals for semantic/return buckets, including `CASH`. React must not recreate indexer/maturity classification rules.

The service derives buckets at request time; no `FireProxy`, `FireReturnBucket`, or historical-return database record is persisted.

## Historical-data pipeline

Extend the existing `generate_fire_returns_ts` workflow. Historical data remains generated deliberately and checked into the React application; `/planning/fire` makes no live market-data request.

Required series:

| Return series | Source/representation |
|---|---|
| IBOV | Existing B3 index history |
| IFIX | Existing B3 index history |
| SPY, VTI, VT, VWRL | Adjusted monthly ETF history; distributions and splits included |
| Bitcoin | Coin Metrics community history |
| CMBI 10 | Coin Metrics index history |
| CDI | Existing BCB SGS history |
| IMA-S, IRF-M 1, IRF-M 1+, IMA-B 5, IMA-B 5+, IMA-Geral ex-C | BCB historical series through May 2023 plus ANBIMA's public historical/current downloads |
| USD/BRL | BCB PTAX selling rate, last available business day of each month |
| IPCA | Existing BCB SGS monthly history |

Relevant official sources include:

- ANBIMA IMA downloads: <https://www.anbima.com.br/informacoes/ima/ima.asp>
- ANBIMA IMA definitions: <https://www.anbima.com.br/pt_br/informar/precos-e-indices/indices/ima.htm>
- Alpha Vantage monthly adjusted ETF data: <https://www.alphavantage.co/documentation/#monthlyadj>
- Coin Metrics community API: <https://docs.coinmetrics.io/api/v4>
- BCB SGS API: <https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo_serie}/dados>

### Return normalization

Starting portfolio values supplied by Django are already normalized to BRL. Transaction-level `current_currency_conversion_rate` remains a cost-basis/operation-date field and is not used as a simulated return series.

For foreign proxies, calculate monthly BRL total return first:

```text
brl_nominal_return =
    (1 + foreign_asset_total_return)
  * (1 + usd_brl_return)
  - 1
```

Then deflate every nominal BRL series by the same month's IPCA:

```text
real_return = (1 + brl_nominal_return) / (1 + monthly_ipca) - 1
```

Use total returns for ETFs and indices. Dividends are not modelled as separate cash flows. Crypto uses price return.

Generated output includes each series' available month keys. User-facing date ranges and sample sizes are derived from generated metadata rather than hard-coded.

## Simulation integration

### Aligned historical months

For every simulated month, all included categories draw returns from the same historical calendar month. This preserves cross-asset correlation.

The eligible sample is the intersection of months available for every included category with a non-zero balance. Categories with zero balance do not restrict the period.

The persisted sampling method determines sequence construction:

- `independent_months` remains the default: independently sample aligned calendar months.
- `contiguous_12_month_blocks`: sample complete historical 12-month sequences while retaining cross-category alignment.

### Category exclusions

Every non-cash category the user owns can be excluded from return modelling. Exclusion:

- Remains persisted by stable category in `excluded_return_categories`.
- Keeps the category's value in FIRE patrimony.
- Removes its return history from the sample-window intersection.
- Assigns that fraction zero nominal return, using the same real-return treatment as cash.
- Does not redistribute its weight to the remaining categories.

There is no hidden materiality threshold. A 0.1% holding restricts the period when included and does not restrict it when explicitly excluded.

Selecting a short-history proxy never blocks calculation. The UI shows the resulting period and warns that a shorter sample makes the simulation less robust.

The simulation keeps its current aggregate portfolio-return mechanics. This project does not introduce a new asset-sale order or rebalancing model.

## User interface

Show one compact historical-data list containing only categories the user currently owns. Each row combines the inclusion control, selected proxy where applicable, and available history:

```text
☑ Renda variável BR — desde 1995
☑ Renda variável Global (VT ▾) — desde 2008
☐ Crypto (CMBI 10 ▾) — desde 2017

Período resultante: 2008–2025
```

Rules:

- Fixed-income rows show the automatically derived proxy; they do not have selectors.
- Proxy selectors appear only for US variable income, global variable income, and crypto.
- Categories the user does not own are hidden.
- Cash is not listed because it never constrains the historical sample.
- A proxy change immediately updates the displayed resulting period.
- A short resulting history produces a warning, not a validation error.
- Proxy selectors communicate the already-approved breadth-versus-history tradeoffs.

The persisted `Preservar sequências históricas de 12 meses` switch remains beside withdrawal rate and retirement duration rather than being duplicated in the historical-data list.

## Migration and rollout

No custom data migration is required for the small current user base.

1. Deploy a schema migration that adds the new asset type and temporarily permits blank `indexer` values.
2. Backfill existing fixed-income indexers and reclassify global holdings through Django shell.
3. Deploy a second schema migration that installs the final database constraints.
4. Translate the legacy FII preference into `excluded_return_categories` when preferences are read or updated, then persist the new shape.

Historical datasets are generated and committed before the new proxy choices become selectable.

## Testing

### Django

- Fixed-income indexer and maturity constraints.
- Non-fixed-income rejection/clearing of fixed-income fields.
- B3 import persistence and refresh of indexer/maturity.
- `timezone.localdate()` boundary mapping for IRF-M and IMA-B buckets.
- Global-equity asset serialization and reporting.
- FIRE allocation totals for every bucket and bank cash.
- Validation, merge behavior, and defaults for new FIRE preferences.

### Dataset generation

- Adjusted ETF return calculation.
- USD/BRL monthly conversion using PTAX.
- IPCA deflation.
- ANBIMA/BCB series stitching without duplicate months.
- Sorted, unique month metadata and reproducible output.
- Total-return rather than raw-price behavior where distributions exist.

### React and simulation

- Default and alternative proxy selection.
- Only owned categories render.
- Exclusions remain in patrimony, earn the cash return, and no longer constrain the sample.
- Dynamic common-window calculation.
- Short-history warning without blocking.
- Independent-month and contiguous-block sampling remain deterministic and aligned across categories.
- Regular FIRE and age-in-bonds consume the same category/proxy selections consistently.

## Explicit non-goals

- Per-asset variable-income proxy selection.
- Live market-data calls during page rendering.
- Historical-return database tables.
- Automatic portfolio rebalancing or liquidation-order modelling.
- Removing cash or excluded categories from FIRE patrimony.
- A hidden exposure threshold that silently ignores small holdings.
- Blocking a user-selected proxy because its history is short.
- Redesigning unrelated FIRE target, expense, chart, verdict, or precision behavior.

## Acceptance criteria

- BR, US, global, FII, crypto, fixed-income subtypes, and cash no longer share inappropriate proxies.
- Current VT/VWRA-family holdings can be represented as `Renda variável Global`.
- Fixed-income proxy selection is deterministic from indexer and current remaining maturity.
- All current balances arrive at React in BRL and sum to existing FIRE patrimony.
- Foreign historical returns include USD/BRL movement before IPCA deflation.
- The user can select SPY/VTI, VT/VWRL, and Bitcoin/CMBI 10 with the approved defaults.
- The user can explicitly exclude any owned non-cash category without removing its value from patrimony.
- The UI always shows the exact historical period produced by included holdings and selected proxies.
- The existing FIRE engine remains deterministic and uses aligned returns under both sampling modes.
