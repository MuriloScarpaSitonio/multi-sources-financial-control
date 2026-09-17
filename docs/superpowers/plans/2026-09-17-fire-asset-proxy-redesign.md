# FIRE Asset-Proxy Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current IBOV/IFIX/CDI FIRE approximation with user-selectable variable-income proxies, automatically derived Brazilian fixed-income proxies, explicit cash treatment, and aligned historical sampling.

**Architecture:** Django remains the source of truth for asset facts and classifies current BRL values into FIRE return buckets through a dedicated endpoint. A deliberate generator downloads and normalizes all historical series into one checked-in TypeScript dataset; React selects category proxies, computes the common sample window, and feeds the existing aggregate bootstrap mechanics. FIRE preferences remain in `CustomUser.planning_preferences`.

**Tech Stack:** Django 5.2, Django REST Framework, PostgreSQL constraints, pytest, React 18, TypeScript, TanStack Query, Material UI, checked-in generated market data.

**Spec:** `docs/superpowers/specs/2026-09-17-fire-asset-proxy-redesign-design.md`

## Global Constraints

- Use the approved variable-income defaults: SPY for US, VT for global, and Bitcoin for crypto.
- Keep cash and excluded categories in FIRE patrimony; assign them zero nominal return and do not redistribute their weights.
- Use every included non-zero category when intersecting available months; do not add a materiality threshold.
- Never block a short-history proxy; display its resulting period and a warning.
- Keep historical data generation deliberate and checked in; `/planning/fire` performs no live market-data requests.
- Preserve the current aggregate contribution, withdrawal, and rebalancing mechanics.
- Do not add per-asset proxy selection, a return-history database table, a liquidation-order model, or a custom backfill migration.
- Use `timezone.localdate()` when deriving fixed-income duration buckets.
- Do not commit any task until the product owner explicitly authorizes that commit.

## File Structure

- `django/variable_income_assets/choices.py`: persisted asset types and fixed-income indexers.
- `django/variable_income_assets/models/write.py`: canonical asset facts and final database constraints.
- `django/variable_income_assets/models/read.py`: CQRS copy used to value and classify holdings.
- `django/variable_income_assets/domain/models.py`: domain validation and asset DTO fields.
- `django/variable_income_assets/serializers.py`: API validation and read/write exposure.
- `django/variable_income_assets/service_layer/tasks/cqrs.py`: write-to-read synchronization.
- `django/variable_income_assets/integrations/b3/handlers.py`: B3 indexer normalization and refresh.
- `django/variable_income_assets/services/fire_allocation.py`: the single asset-to-FIRE-bucket classifier.
- `django/variable_income_assets/views.py`: authenticated FIRE allocation endpoint.
- `django/variable_income_assets/fire_returns/series.py`: pure return-series parsing, normalization, and rendering.
- `django/variable_income_assets/fire_returns/sources.py`: source-specific B3, BCB, Alpha Vantage, Coin Metrics, PTAX, and ANBIMA downloads.
- `django/variable_income_assets/scripts.py`: public `generate_fire_returns_ts` orchestration entry point.
- `react/src/pages/private/Planning/fireAllocation.ts`: allocation API types, fetcher, and query hook.
- `react/src/pages/private/Home/fireReturnTypes.ts`: stable handwritten return/category contracts.
- `react/src/pages/private/Home/fireReturns.ts`: generated monthly real-return dataset.
- `react/src/pages/private/Home/firePortfolio.ts`: proxy resolution, exclusions, sample intersection, and age-in-bonds portfolio transforms.
- `react/src/pages/private/Home/fireBootstrap.ts`: aggregate simulations consuming generalized portfolio slices and sampling sequences.
- `react/src/pages/private/Planning/FireHistoricalDataControls.tsx`: compact inclusion/proxy/history UI.
- Existing FIRE indicators and planning screens: consume the new allocation and preference contracts without changing unrelated FIRE behavior.

---

### Task 1: Add asset taxonomy and indexer facts without final constraints

**Files:**
- Modify: `django/variable_income_assets/choices.py`
- Modify: `django/variable_income_assets/models/write.py`
- Modify: `django/variable_income_assets/models/read.py`
- Modify: `django/variable_income_assets/domain/models.py`
- Modify: `django/variable_income_assets/serializers.py`
- Modify: `django/variable_income_assets/adapters/sql.py`
- Modify: `django/variable_income_assets/integrations/helpers.py`
- Modify: `django/variable_income_assets/integrations/handlers.py`
- Modify: `django/variable_income_assets/service_layer/tasks/cqrs.py`
- Modify: `django/variable_income_assets/tests/conftest.py`
- Modify: `django/variable_income_assets/tests/e2e/test_asset_endpoints.py`
- Modify: `django/variable_income_assets/tests/tasks/test__cqrs.py`
- Create: `django/variable_income_assets/migrations/0030_asset_indexer_and_global_equity.py`

**Interfaces:**
- Produces: `AssetTypes.equity_global == "EQUITY_GLOBAL"`.
- Produces: `FixedIncomeIndexers` with `CDI`, `SELIC`, `IPCA`, and `PREFIXED`.
- Produces: nullable/blank-compatible `Asset.indexer`, `AssetReadModel.indexer`, and domain `Asset.indexer` during rollout phase one.
- Preserves: `Asset.to_domain()` now transfers `liquidity_type`, `maturity_date`, and `indexer`.

- [ ] **Step 1: Write failing API and CQRS tests**

```python
def test__create_global_equity_asset(client, user):
    client.force_authenticate(user)
    response = client.post(
        "/api/v1/assets",
        {
            "code": "VT",
            "type": "EQUITY_GLOBAL",
            "currency": "USD",
            "objective": "GROWTH",
        },
    )
    assert response.status_code == 201
    assert response.data["type"] == "Renda variável Global"


def test__fixed_income_indexer_reaches_read_model(user):
    asset = Asset.objects.create(
        user=user,
        code="CDB-TEST",
        type="FIXED_BR",
        currency="BRL",
        indexer="IPCA",
    )
    AssetMetaData.objects.create(
        code=asset.code,
        type=asset.type,
        currency=asset.currency,
        current_price=Decimal("1"),
    )
    upsert_asset_read_model(asset.id)
    assert AssetReadModel.objects.get(write_model_pk=asset.id).indexer == "IPCA"


def test__to_domain_preserves_fixed_income_facts(user):
    maturity = date(2035, 5, 15)
    asset = Asset.objects.create(
        user=user,
        code="CDB-DOMAIN",
        type="FIXED_BR",
        currency="BRL",
        liquidity_type="AT_MATURITY",
        maturity_date=maturity,
        indexer="PREFIXED",
    )
    domain = asset.to_domain()
    assert (domain.liquidity_type, domain.maturity_date, domain.indexer) == (
        "AT_MATURITY",
        maturity,
        "PREFIXED",
    )
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `uv run pytest variable_income_assets/tests/e2e/test_asset_endpoints.py variable_income_assets/tests/tasks/test__cqrs.py -q`

Expected: failures for the unknown `EQUITY_GLOBAL` type, missing `indexer`, and omitted domain fields.

- [ ] **Step 3: Add choices and thread the new field through every asset representation**

```python
class FixedIncomeIndexers(DjangoChoices):
    cdi = ChoiceItem("CDI", label="CDI")
    selic = ChoiceItem("SELIC", label="Selic")
    ipca = ChoiceItem("IPCA", label="IPCA")
    prefixed = ChoiceItem("PREFIXED", label="Prefixado")


class AssetTypes(DjangoChoices):
    stock = ChoiceItem(
        "STOCK",
        label="Renda variável BR",
        monthly_sell_threshold=settings.STOCKS_MONTHLY_SELL_EXEMPTION_THRESHOLD,
        valid_currencies=(Currencies.real,),
        accept_incomes=True,
    )
    stock_usa = ChoiceItem(
        "STOCK_USA",
        label="Renda variável EUA",
        monthly_sell_threshold=settings.STOCKS_USA_MONTHLY_SELL_EXEMPTION_THRESHOLD,
        valid_currencies=(Currencies.dollar,),
        accept_incomes=True,
    )
    equity_global = ChoiceItem(
        "EQUITY_GLOBAL",
        label="Renda variável Global",
        monthly_sell_threshold=settings.STOCKS_USA_MONTHLY_SELL_EXEMPTION_THRESHOLD,
        valid_currencies=(Currencies.dollar,),
        accept_incomes=True,
    )
```

Use `max_length=20` for all persisted asset-type fields. Add the rollout field to both Django models:

```python
indexer = models.CharField(
    max_length=10,
    validators=[FixedIncomeIndexers.validator],
    blank=True,
    default="",
)
```

Add this domain field and transfer all fixed-income facts in `Asset.to_domain()`:

```python
indexer: choices_to_enum(FixedIncomeIndexers) | None = None

return AssetDomainModel(
    id=self.pk,
    code=self.code,
    type=self.type,
    objective=self.objective,
    description=self.description,
    currency=self.currency,
    is_held_in_self_custody=self.is_held_in_self_custody,
    liquidity_type=self.liquidity_type or None,
    maturity_date=self.maturity_date,
    indexer=self.indexer or None,
    quantity_balance=getattr(self, "quantity_balance", None),
    avg_price=getattr(self, "avg_price", None),
    total_sold=getattr(self, "total_sold", None),
)
```

Add `indexer` to `AssetSerializer`, `AssetReadModelSerializer`, `AssetRepository`, and every non-aggregate/default branch of `upsert_asset_read_model`.

Treat `EQUITY_GLOBAL` like `STOCK_USA` in `fetch_asset_current_price`, `fetch_asset_close_price`, and the batched `_fetch_prices` integration. Add a separate global-code batch but reuse `get_stocks_usa_prices`; tag its metadata with `AssetTypes.equity_global` so the lookup key remains `code-type-currency`.

- [ ] **Step 4: Generate and inspect the phase-one migration**

Run: `uv run python manage.py makemigrations variable_income_assets --name asset_indexer_and_global_equity`

Expected: migration `0030` alters the three asset-type fields to length 20 and adds blank/default `indexer` fields to `Asset` and `AssetReadModel`; it contains no data operation and no final indexer constraint.

- [ ] **Step 5: Run the focused tests and model checks**

Run: `uv run pytest variable_income_assets/tests/e2e/test_asset_endpoints.py variable_income_assets/tests/tasks/test__cqrs.py -q`

Run: `uv run python manage.py check`

Expected: both commands pass.

- [ ] **Step 6: Commit only after explicit authorization**

```bash
git add django/variable_income_assets
git commit -m "feat: add FIRE asset classification facts"
```

---

### Task 2: Validate and refresh fixed-income indexers

**Files:**
- Modify: `django/variable_income_assets/domain/models.py`
- Modify: `django/variable_income_assets/domain/exceptions.py`
- Modify: `django/variable_income_assets/serializers.py`
- Modify: `django/variable_income_assets/integrations/b3/handlers.py`
- Modify: `django/variable_income_assets/tests/e2e/test_asset_endpoints.py`
- Modify: `django/variable_income_assets/tests/integrations/test__b3_handlers.py`

**Interfaces:**
- Produces: `normalize_fixed_income_indexer(raw: str | None) -> str | None`.
- Enforces in API/domain: fixed income requires an indexer; IPCA and prefixado require maturity; non-fixed assets clear fixed-income fields.
- Preserves: a maturity date may be absent for CDI and Selic.

- [ ] **Step 1: Write failing validation and import tests**

```python
@pytest.mark.parametrize("indexer", ["IPCA", "PREFIXED"])
def test__fixed_income_duration_indexer_requires_maturity(client, user, indexer):
    client.force_authenticate(user)
    response = client.post(
        "/api/v1/assets",
        {
            "code": "RF-1",
            "type": "FIXED_BR",
            "currency": "BRL",
            "objective": "GROWTH",
            "liquidity_type": "AT_MATURITY",
            "indexer": indexer,
        },
    )
    assert response.status_code == 400
    assert "maturity_date" in response.data


def test__non_fixed_asset_clears_fixed_income_facts(client, stock_asset):
    response = client.put(
        f"/api/v1/assets/{stock_asset.id}",
        {
            "code": stock_asset.code,
            "type": "STOCK",
            "currency": "BRL",
            "objective": "GROWTH",
            "indexer": "CDI",
            "liquidity_type": "DAILY",
            "maturity_date": "15/05/2035",
        },
    )
    assert response.status_code == 200
    stock_asset.refresh_from_db()
    assert (stock_asset.indexer, stock_asset.liquidity_type, stock_asset.maturity_date) == (
        "",
        "",
        None,
    )


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("DI", "CDI"), ("CDI", "CDI"), ("SELIC", "SELIC"), ("IPCA", "IPCA"), ("PREFIXADO", "PREFIXED")],
)
def test__normalizes_b3_indexer(raw, expected):
    assert normalize_fixed_income_indexer(raw) == expected
```

- [ ] **Step 2: Run the tests and verify validation/import failures**

Run: `uv run pytest variable_income_assets/tests/e2e/test_asset_endpoints.py variable_income_assets/tests/integrations/test__b3_handlers.py -q`

Expected: the API accepts invalid combinations and the normalization function is missing.

- [ ] **Step 3: Implement serializer and domain invariants**

```python
if self.type == AssetTypes.fixed_br:
    if not self.indexer:
        raise FixedIncomeIndexerRequiredException
    if self.indexer in (FixedIncomeIndexers.ipca, FixedIncomeIndexers.prefixed):
        if self.maturity_date is None:
            raise FixedIncomeMaturityRequiredException
else:
    self.indexer = None
    self.liquidity_type = None
    self.maturity_date = None
```

Mirror the same rules in `AssetSerializer.validate()` to return field-specific DRF errors. Resolve partial updates with `attrs.get(field, getattr(self.instance, field, None))`, and keep the existing future-maturity-on-create check.

- [ ] **Step 4: Normalize and persist B3 facts on create and refresh**

```python
_INDEXER_ALIASES = {
    "DI": FixedIncomeIndexers.cdi,
    "CDI": FixedIncomeIndexers.cdi,
    "SELIC": FixedIncomeIndexers.selic,
    "IPCA": FixedIncomeIndexers.ipca,
    "PREFIXADO": FixedIncomeIndexers.prefixed,
    "PREFIXED": FixedIncomeIndexers.prefixed,
}


def normalize_fixed_income_indexer(raw: str | None) -> str | None:
    if raw is None:
        return None
    return _INDEXER_ALIASES.get(raw.strip().upper())
```

Pass normalized `indexer` and parsed `maturity_date` to both fixed-income asset creation paths. When a known asset appears in a newer position file, update `indexer` and `maturity_date` on the canonical asset and call the existing synchronous CQRS update path so `AssetReadModel` is refreshed; continue batching price updates separately.

- [ ] **Step 5: Run fixed-income API/import tests**

Run: `uv run pytest variable_income_assets/tests/e2e/test_asset_endpoints.py variable_income_assets/tests/integrations/test__b3_handlers.py variable_income_assets/integrations/b3/tests -q`

Expected: all tests pass, including indexer/maturity refresh for existing assets.

- [ ] **Step 6: Commit only after explicit authorization**

```bash
git add django/variable_income_assets
git commit -m "feat: validate fixed income proxy inputs"
```

---

### Task 3: Persist and normalize FIRE proxy preferences

**Files:**
- Create: `django/authentication/services/planning_preferences.py`
- Modify: `django/authentication/serializers.py`
- Modify: `django/authentication/tests/test__user__views.py`
- Create: `react/src/pages/private/Home/fireReturnTypes.ts`
- Modify: `react/src/pages/private/Planning/api.ts`

**Interfaces:**
- Produces: `normalize_planning_preferences(value: dict) -> tuple[dict, bool]`.
- Produces React values: `SamplingMethod`, `UsEquityProxy`, `GlobalEquityProxy`, `CryptoProxy`, and `ReturnCategory`.
- Defaults: `independent_months`, `SPY`, `VT`, `BTC`, and an empty exclusion list.

- [ ] **Step 1: Write failing preference validation and legacy-normalization tests**

```python
def test__partial_update__planning_preferences__fire_proxy_fields(client, user):
    client.force_authenticate(user)
    response = client.patch(
        f"/api/v1/users/{user.id}",
        {
            "planning_preferences": {
                "selected_method": "fire",
                "fire": {
                    "sampling_method": "contiguous_12_month_blocks",
                    "us_equity_proxy": "VTI",
                    "global_equity_proxy": "VWRL",
                    "crypto_proxy": "CMBI10",
                    "excluded_return_categories": ["FII", "FIXED_IPCA"],
                },
            }
        },
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.data["planning_preferences"]["fire"]["crypto_proxy"] == "CMBI10"


def test__retrieve__translates_and_persists_legacy_ifix_preference(client, user):
    user.planning_preferences = {
        "selected_method": "fire",
        "fire": {"exclude_ifix_from_sim": True},
    }
    user.save(update_fields=("planning_preferences",))
    client.force_authenticate(user)
    response = client.get(f"/api/v1/users/{user.id}")
    fire = response.data["planning_preferences"]["fire"]
    assert fire["excluded_return_categories"] == ["FII"]
    assert "exclude_ifix_from_sim" not in fire
    user.refresh_from_db()
    assert user.planning_preferences["fire"] == fire
```

- [ ] **Step 2: Run the focused authentication tests and verify failure**

Run: `uv run pytest authentication/tests/test__user__views.py -q`

Expected: new keys are rejected or omitted and the old IFIX preference remains stored.

- [ ] **Step 3: Implement strict nested choices and idempotent legacy conversion**

```python
RETURN_CATEGORIES = (
    "BR_EQUITY",
    "US_EQUITY",
    "GLOBAL_EQUITY",
    "FII",
    "CRYPTO",
    "FIXED_CDI",
    "FIXED_SELIC",
    "FIXED_PREFIXED",
    "FIXED_IPCA",
)


def normalize_planning_preferences(value: dict) -> tuple[dict, bool]:
    normalized = deepcopy(value or {})
    fire = normalized.setdefault("fire", {})
    legacy = fire.pop("exclude_ifix_from_sim", None)
    excluded = list(dict.fromkeys(fire.get("excluded_return_categories", [])))
    if legacy is True and "FII" not in excluded:
        excluded.append("FII")
    fire["excluded_return_categories"] = excluded
    return normalized, normalized != (value or {})
```

Add DRF `ChoiceField`/`ListField` declarations for the new keys. Normalize before merging updates and before representation; when representation changes a persisted user's JSON, save only `planning_preferences` once. Keep the helper idempotent so subsequent reads do not write.

- [ ] **Step 4: Extend the React preference contract**

```typescript
export type SamplingMethod = "independent_months" | "contiguous_12_month_blocks";
export type UsEquityProxy = "SPY" | "VTI";
export type GlobalEquityProxy = "VT" | "VWRL";
export type CryptoProxy = "BTC" | "CMBI10";

export type ReturnCategory =
  | "BR_EQUITY" | "US_EQUITY" | "GLOBAL_EQUITY" | "FII" | "CRYPTO"
  | "FIXED_CDI" | "FIXED_SELIC" | "FIXED_PREFIXED" | "FIXED_IPCA";

export type FireReturnSeriesKey =
  | "IBOV" | "IFIX" | "SPY" | "VTI" | "VT" | "VWRL"
  | "BTC" | "CMBI10" | "CDI" | "IMA_S" | "IRF_M_1"
  | "IRF_M_1_PLUS" | "IMA_B_5" | "IMA_B_5_PLUS"
  | "IMA_GERAL_EX_C" | "CASH";

export type FirePlanningPreferences = {
  withdrawal_rate?: number;
  target_years?: number;
  monthly_expenses_override?: number | null;
  sampling_method?: SamplingMethod;
  us_equity_proxy?: UsEquityProxy;
  global_equity_proxy?: GlobalEquityProxy;
  crypto_proxy?: CryptoProxy;
  excluded_return_categories?: ReturnCategory[];
};
```

Define `ReturnCategory` in `fireReturnTypes.ts`, import it into `Planning/api.ts`, remove `exclude_ifix_from_sim` from the React contract, and include the approved defaults in `DEFAULT_FIRE_PREFERENCES`.

- [ ] **Step 5: Verify backend tests and frontend type checking**

Run: `uv run pytest authentication/tests/test__user__views.py -q`

Run: `yarn --cwd ../react build`

Expected: both commands pass.

- [ ] **Step 6: Commit only after explicit authorization**

```bash
git add django/authentication react/src/pages/private/Home/fireReturnTypes.ts react/src/pages/private/Planning/api.ts
git commit -m "feat: persist FIRE proxy preferences"
```

---

### Task 4: Add the Django FIRE allocation service and endpoint

**Files:**
- Create: `django/variable_income_assets/services/__init__.py`
- Create: `django/variable_income_assets/services/fire_allocation.py`
- Modify: `django/variable_income_assets/serializers.py`
- Modify: `django/variable_income_assets/views.py`
- Create: `django/variable_income_assets/tests/test__fire_allocation.py`
- Modify: `django/variable_income_assets/tests/e2e/test_asset_endpoints.py`
- Create: `react/src/pages/private/Planning/fireAllocation.ts`

**Interfaces:**
- Produces: `classify_return_bucket(*, asset_type: str, indexer: str, maturity_date: date | None, today: date) -> tuple[str, str]`.
- Produces: `build_fire_allocation(*, user_id: int, today: date | None = None) -> list[FireAllocationBucket]`.
- Endpoint: `GET /api/v1/assets/fire_allocation`.
- Response item: `{ category: ReturnCategory | "CASH", series: FireReturnSeriesKey | null, total: string }`; selectable US/global/crypto categories use `series: null` because React resolves the current local preference.

- [ ] **Step 1: Write failing pure classification tests**

```python
@pytest.mark.parametrize(
    ("indexer", "maturity", "expected"),
    [
        ("CDI", None, ("FIXED_CDI", "CDI")),
        ("SELIC", None, ("FIXED_SELIC", "IMA_S")),
        ("PREFIXED", date(2027, 9, 17), ("FIXED_PREFIXED", "IRF_M_1")),
        ("PREFIXED", date(2027, 9, 18), ("FIXED_PREFIXED", "IRF_M_1_PLUS")),
        ("IPCA", date(2031, 9, 17), ("FIXED_IPCA", "IMA_B_5")),
        ("IPCA", date(2031, 9, 18), ("FIXED_IPCA", "IMA_B_5_PLUS")),
    ],
)
def test__classify_fixed_income(indexer, maturity, expected):
    assert classify_return_bucket(
        asset_type="FIXED_BR",
        indexer=indexer,
        maturity_date=maturity,
        today=date(2026, 9, 17),
    ) == expected
```

- [ ] **Step 2: Write a failing endpoint aggregation test**

```python
def test__fire_allocation_returns_current_brl_totals_and_cash(
    client, user, asset_read_model_factory, bank_account_factory, dollar_rate
):
    asset_read_model_factory(user_id=user.id, type="STOCK", current_total="1000")
    asset_read_model_factory(
        user_id=user.id,
        type="FIXED_BR",
        indexer="IPCA",
        maturity_date=date(2035, 1, 1),
        current_total="2000",
    )
    bank_account_factory(user=user, amount="500")
    client.force_authenticate(user)
    response = client.get("/api/v1/assets/fire_allocation")
    assert response.status_code == 200
    assert response.data == {
        "as_of": "2026-09-17",
        "buckets": [
            {"category": "BR_EQUITY", "series": "IBOV", "total": "1000.00"},
            {"category": "FIXED_IPCA", "series": "IMA_B_5_PLUS", "total": "2000.00"},
            {"category": "CASH", "series": "CASH", "total": "500.00"},
        ],
    }
```

- [ ] **Step 3: Run the service/endpoint tests and verify failure**

Run: `uv run pytest variable_income_assets/tests/test__fire_allocation.py variable_income_assets/tests/e2e/test_asset_endpoints.py -q`

Expected: the classifier and endpoint do not exist.

- [ ] **Step 4: Implement the sole classification service**

```python
@dataclass(frozen=True)
class FireAllocationBucket:
    category: str
    series: str | None
    total: Decimal


def classify_return_bucket(*, asset_type, indexer, maturity_date, today):
    if asset_type == AssetTypes.stock:
        return "BR_EQUITY", "IBOV"
    if asset_type == AssetTypes.stock_usa:
        return "US_EQUITY", None
    if asset_type == AssetTypes.equity_global:
        return "GLOBAL_EQUITY", None
    if asset_type == AssetTypes.fii:
        return "FII", "IFIX"
    if asset_type == AssetTypes.crypto:
        return "CRYPTO", None
    if indexer == FixedIncomeIndexers.cdi:
        return "FIXED_CDI", "CDI"
    if indexer == FixedIncomeIndexers.selic:
        return "FIXED_SELIC", "IMA_S"
    if indexer == FixedIncomeIndexers.prefixed:
        key = "IRF_M_1" if maturity_date <= today + relativedelta(years=1) else "IRF_M_1_PLUS"
        return "FIXED_PREFIXED", key
    key = "IMA_B_5" if maturity_date <= today + relativedelta(years=5) else "IMA_B_5_PLUS"
    return "FIXED_IPCA", key
```

Query `AssetReadModel` with `annotate_normalized_current_total()`, group by the classifier result in Python, drop zero totals, append `BankAccount.objects.get_total(user_id)` as `CASH`, and sort by a fixed domain order for stable responses.

- [ ] **Step 5: Add the DRF action and React query contract**

```python
@action(methods=("GET",), detail=False, url_path="fire_allocation")
def fire_allocation(self, request: Request) -> Response:
    buckets = build_fire_allocation(user_id=request.user.id)
    serializer = FireAllocationResponseSerializer(
        {"as_of": timezone.localdate(), "buckets": buckets}
    )
    return Response(serializer.data)
```

```typescript
export type FireAllocationBucket = {
  category: ReturnCategory | "CASH";
  series: FireReturnSeriesKey | null;
  total: number;
};

export const useFireAllocation = () =>
  useQuery({
    queryKey: ["fire-allocation"],
    queryFn: async () =>
      (await apiProvider.get<FireAllocationResponse>("assets/fire_allocation")).data,
  });
```

- [ ] **Step 6: Verify service tests, endpoint schema, and frontend compilation**

Run: `uv run pytest variable_income_assets/tests/test__fire_allocation.py variable_income_assets/tests/e2e/test_asset_endpoints.py -q`

Run: `uv run python manage.py spectacular --file /tmp/fire-openapi.yml --validate`

Run: `yarn --cwd ../react build`

Expected: all commands pass.

- [ ] **Step 7: Commit only after explicit authorization**

```bash
git add django/variable_income_assets react/src/pages/private/Planning/fireAllocation.ts
git commit -m "feat: expose FIRE return allocation"
```

---

### Task 5: Generate the complete monthly real-return dataset

**Files:**
- Create: `django/variable_income_assets/fire_returns/__init__.py`
- Create: `django/variable_income_assets/fire_returns/series.py`
- Create: `django/variable_income_assets/fire_returns/sources.py`
- Modify: `django/variable_income_assets/scripts.py`
- Create: `django/variable_income_assets/tests/test__fire_returns.py`
- Modify: `django/variable_income_assets/tests/test_scripts.py`
- Modify: `react/src/pages/private/Home/fireReturnTypes.ts`
- Regenerate: `react/src/pages/private/Home/fireReturns.ts`

**Interfaces:**
- Produces Python: `MonthlySeries = dict[str, Decimal]` keyed by `YYYY-MM`.
- Produces Python: `to_real_returns(nominal, ipca)`, `foreign_to_brl_returns(foreign, ptax)`, and `render_fire_returns_ts(series)`.
- Produces Python source functions: `fetch_b3_index_monthly(index, start_year, end_year)`, `fetch_bcb_sgs_monthly(series_id, start_year, end_year)`, `fetch_alpha_vantage_adjusted_monthly(symbol, api_key)`, `fetch_coin_metrics_asset_monthly(asset)`, `fetch_coin_metrics_index_monthly(index)`, `fetch_ptax_month_end_selling(start_year, end_year)`, `fetch_anbima_ima_monthly(index, start_year, end_year)`, and `fetch_ima_monthly(index, start_year, end_year)`.
- Produces TypeScript: `FIRE_RETURN_SERIES: Record<FireReturnSeriesKey, { label: string; months: readonly string[]; realReturns: readonly number[] }>`.

- [ ] **Step 1: Write failing pure normalization/rendering tests**

```python
def test__foreign_total_return_is_converted_to_brl_then_deflated():
    result = normalize_foreign_real_returns(
        foreign_total_returns={"2020-01": Decimal("0.10")},
        usd_brl_returns={"2020-01": Decimal("0.05")},
        ipca_returns={"2020-01": Decimal("0.02")},
    )
    assert result["2020-01"] == pytest.approx(Decimal("0.1323529412"))


def test__cash_is_zero_nominal_return_deflated_by_ipca():
    assert cash_real_returns({"2020-01": Decimal("0.01")}) == {
        "2020-01": pytest.approx(Decimal("-0.0099009901"))
    }


def test__renderer_preserves_each_series_own_months():
    rendered = render_fire_returns_ts(
        {
            "IBOV": {"1995-01": Decimal("0.01")},
            "VT": {"2008-07": Decimal("-0.02")},
        }
    )
    assert 'IBOV: { label: "IBOV", months: ["1995-01"]' in rendered
    assert 'VT: { label: "VT", months: ["2008-07"]' in rendered
```

- [ ] **Step 2: Run the pure tests and verify failure**

Run: `uv run pytest variable_income_assets/tests/test__fire_returns.py variable_income_assets/tests/test_scripts.py -q`

Expected: the new return modules and generalized output do not exist.

- [ ] **Step 3: Implement source-independent monthly transformations**

```python
def to_real_returns(nominal: MonthlySeries, ipca: MonthlySeries) -> MonthlySeries:
    return {
        month: (Decimal(1) + value) / (Decimal(1) + ipca[month]) - Decimal(1)
        for month, value in nominal.items()
        if month in ipca
    }


def foreign_to_brl_returns(
    foreign: MonthlySeries, usd_brl: MonthlySeries
) -> MonthlySeries:
    return {
        month: (Decimal(1) + value) * (Decimal(1) + usd_brl[month]) - Decimal(1)
        for month, value in foreign.items()
        if month in usd_brl
    }


def cash_real_returns(ipca: MonthlySeries) -> MonthlySeries:
    return {
        month: Decimal(1) / (Decimal(1) + value) - Decimal(1)
        for month, value in ipca.items()
    }
```

Derive month-end returns from adjusted closes/index levels, compute PTAX changes from the last available selling rate of adjacent months, and never forward-fill a missing return month.

- [ ] **Step 4: Implement explicit source clients**

```python
ETF_SYMBOLS = ("SPY", "VTI", "VT", "VWRL")
BCB_SGS_SERIES = {
    "CDI": 4391,
    "IPCA": 433,
    "IMA_S": 12462,
    "IMA_B_5": 12467,
    "IRF_M_1": 17626,
    "IRF_M_1_PLUS": 17627,
    "IMA_GERAL_EX_C": 17628,
}
COIN_METRICS_ASSETS = {"BTC": "btc"}
COIN_METRICS_INDEXES = {"CMBI10": "CMBI10"}

IMA_BCB_IDS = {
    "IMA-S": 12462,
    "IRF-M 1": 17626,
    "IRF-M 1+": 17627,
    "IMA-B 5": 12467,
    "IMA-Geral ex-C": 17628,
}


def fetch_ima_monthly(index: str, start_year: int, end_year: int) -> MonthlySeries:
    series_id = IMA_BCB_IDS.get(index)
    legacy = (
        fetch_bcb_sgs_monthly(series_id, start_year, min(end_year, 2023))
        if series_id is not None
        else {}
    )
    public = fetch_anbima_ima_monthly(index, start_year, end_year)
    return {
        **{month: value for month, value in legacy.items() if month <= "2023-05"},
        **{month: value for month, value in public.items() if month >= "2023-06"},
    }
```

Implement source clients with these exact HTTP contracts and pure parsers:

```python
ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query"
COIN_METRICS_URL = "https://community-api.coinmetrics.io/v4"
PTAX_URL = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata"


def fetch_alpha_vantage_adjusted_monthly(symbol: str, api_key: str) -> MonthlySeries:
    payload = fetch_json(
        ALPHA_VANTAGE_URL,
        params={
            "function": "TIME_SERIES_MONTHLY_ADJUSTED",
            "symbol": symbol,
            "apikey": api_key,
            "outputsize": "full",
        },
    )
    closes = {
        month[:7]: Decimal(row["5. adjusted close"])
        for month, row in payload["Monthly Adjusted Time Series"].items()
    }
    return close_levels_to_returns(closes)


def fetch_coin_metrics_asset_monthly(asset: str) -> MonthlySeries:
    payload = fetch_json(
        f"{COIN_METRICS_URL}/timeseries/asset-metrics",
        params={"assets": asset, "metrics": "ReferenceRateUSD", "frequency": "1d"},
    )
    return daily_levels_to_monthly_returns(payload["data"], value_field="ReferenceRateUSD")


def fetch_coin_metrics_index_monthly(index: str) -> MonthlySeries:
    payload = fetch_json(
        f"{COIN_METRICS_URL}/timeseries/index-levels",
        params={"indexes": index, "frequency": "1d"},
    )
    return daily_levels_to_monthly_returns(payload["data"], value_field="level")
```

The shared helpers used by those clients are:

```python
from itertools import pairwise
import json
import urllib.parse
import urllib.request


def fetch_json(url: str, params: dict[str, str] | None = None) -> dict | list:
    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    request = urllib.request.Request(
        f"{url}{query}",
        headers={"User-Agent": "multi-sources-financial-control/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def close_levels_to_returns(levels: dict[str, Decimal]) -> MonthlySeries:
    months = sorted(levels)
    return {
        current: levels[current] / levels[previous] - Decimal(1)
        for previous, current in pairwise(months)
    }


def daily_levels_to_monthly_returns(rows: list[dict], value_field: str) -> MonthlySeries:
    month_end: dict[str, tuple[str, Decimal]] = {}
    for row in rows:
        day = row["time"][:10]
        month = day[:7]
        if month not in month_end or day > month_end[month][0]:
            month_end[month] = (day, Decimal(row[value_field]))
    return close_levels_to_returns({month: value for month, (_, value) in month_end.items()})
```

Keep the already-tested B3 payload construction and BCB SGS row parser when moving them out of `scripts.py`. Parse PTAX `CotacaoDolarPeriodo` rows using `cotacaoVenda` and `dataHoraCotacao`, retaining the last business-day quote per month before converting levels to returns. Parse ANBIMA's public IMA historical/current downloads into month-end index levels using their date, index name, and index-number columns. Merge each IMA series as `{**bcb_history_through_2023_05, **anbima_history_after_2023_05}` so ANBIMA wins at and after the handoff. Add `IMA_B_5_PLUS` from the matching ANBIMA series because no approved BCB continuation was identified for it.

Compose the final real-BRL dataset in one function; this is the only place that decides which source feeds each generated key:

```python
def build_fire_return_series(
    *,
    start_year: int,
    end_year: int,
    alpha_vantage_api_key: str,
) -> dict[str, MonthlySeries]:
    ipca = fetch_bcb_sgs_monthly(BCB_SGS_SERIES["IPCA"], start_year, end_year)
    usd_brl = close_levels_to_returns(fetch_ptax_month_end_selling(start_year, end_year))

    brl_nominal = {
        "IBOV": fetch_b3_index_monthly("IBOV", start_year, end_year),
        "IFIX": fetch_b3_index_monthly("IFIX", start_year, end_year),
        "CDI": fetch_bcb_sgs_monthly(BCB_SGS_SERIES["CDI"], start_year, end_year),
        "IMA_S": fetch_ima_monthly("IMA-S", start_year, end_year),
        "IRF_M_1": fetch_ima_monthly("IRF-M 1", start_year, end_year),
        "IRF_M_1_PLUS": fetch_ima_monthly("IRF-M 1+", start_year, end_year),
        "IMA_B_5": fetch_ima_monthly("IMA-B 5", start_year, end_year),
        "IMA_B_5_PLUS": fetch_ima_monthly("IMA-B 5+", start_year, end_year),
        "IMA_GERAL_EX_C": fetch_ima_monthly("IMA-Geral ex-C", start_year, end_year),
    }
    foreign_nominal = {
        symbol: fetch_alpha_vantage_adjusted_monthly(symbol, alpha_vantage_api_key)
        for symbol in ETF_SYMBOLS
    }
    foreign_nominal["BTC"] = fetch_coin_metrics_asset_monthly("btc")
    foreign_nominal["CMBI10"] = fetch_coin_metrics_index_monthly("CMBI10")

    result = {
        key: to_real_returns(values, ipca)
        for key, values in brl_nominal.items()
    }
    result.update(
        {
            key: to_real_returns(foreign_to_brl_returns(values, usd_brl), ipca)
            for key, values in foreign_nominal.items()
        }
    )
    result["CASH"] = cash_real_returns(ipca)
    return result
```

- [ ] **Step 5: Generalize the orchestration and generated TypeScript contract**

Build these real BRL series: `IBOV`, `IFIX`, `SPY`, `VTI`, `VT`, `VWRL`, `BTC`, `CMBI10`, `CDI`, `IMA_S`, `IRF_M_1`, `IRF_M_1_PLUS`, `IMA_B_5`, `IMA_B_5_PLUS`, `IMA_GERAL_EX_C`, and `CASH`.

```typescript
The stable type created in Task 3 must contain exactly these generated keys:

```typescript
export type FireReturnSeriesKey =
  | "IBOV" | "IFIX" | "SPY" | "VTI" | "VT" | "VWRL"
  | "BTC" | "CMBI10" | "CDI" | "IMA_S" | "IRF_M_1"
  | "IRF_M_1_PLUS" | "IMA_B_5" | "IMA_B_5_PLUS"
  | "IMA_GERAL_EX_C" | "CASH";
```

Keep the public entry point:

```python
def generate_fire_returns_ts(
    output_path="../react/src/pages/private/Home/fireReturns.ts",
    start_year=1995,
    end_year=None,
) -> None:
    series = build_fire_return_series(
        start_year=start_year,
        end_year=end_year or timezone.localdate().year - 1,
        alpha_vantage_api_key=os.environ["ALPHA_VANTAGE_API_KEY"],
    )
    Path(output_path).write_text(render_fire_returns_ts(series), encoding="utf-8")
```

Read the Alpha Vantage key from `ALPHA_VANTAGE_API_KEY`; do not embed any key in code or generated output.

- [ ] **Step 6: Run fixture-backed generator tests**

Run: `uv run pytest variable_income_assets/tests/test__fire_returns.py variable_income_assets/tests/test_scripts.py -q`

Expected: all source parsers, return formulas, handoff behavior, and TypeScript rendering pass without network access.

- [ ] **Step 7: Generate the checked-in dataset and validate it**

Run: `uv run python manage.py shell -c "from variable_income_assets.scripts import generate_fire_returns_ts; generate_fire_returns_ts()"`

Run: `yarn --cwd ../react build`

Expected: the generated module contains all 16 series, each has sorted unique months with equal `months`/`realReturns` lengths, and the React build passes.

- [ ] **Step 8: Commit only after explicit authorization**

```bash
git add django/variable_income_assets/fire_returns django/variable_income_assets/scripts.py django/variable_income_assets/tests react/src/pages/private/Home/fireReturnTypes.ts react/src/pages/private/Home/fireReturns.ts
git commit -m "feat: generate FIRE proxy return histories"
```

---

### Task 6: Generalize the FIRE portfolio and sampling engine

**Files:**
- Create: `react/src/pages/private/Home/firePortfolio.ts`
- Create: `react/src/pages/private/Home/firePortfolio.test.ts`
- Modify: `react/src/pages/private/Home/fireBootstrap.ts`
- Create: `react/src/pages/private/Home/fireBootstrap.test.ts`
- Modify: `react/package.json`

**Interfaces:**
- Produces: `PortfolioSlice = { category: ReturnCategory | "CASH"; series: FireReturnSeriesKey; weight: number; constrainsSample: boolean }`.
- Produces: `buildPortfolio(allocation, preferences)`, `eligibleMonths(portfolio)`, and `buildAgeInBondsPortfolio(base, stockFraction)`.
- Changes bootstrap inputs from three hard-coded weights to `PortfolioSlice[]` or `PortfolioAtFn` while preserving result types and withdrawal/contribution timing.

- [ ] **Step 1: Add an executable TypeScript test command**

Add `tsx` to dev dependencies and this script:

```json
{
  "scripts": {
    "test:fire": "tsx src/pages/private/Home/firePortfolio.test.ts && tsx src/pages/private/Home/fireBootstrap.test.ts"
  },
  "devDependencies": {
    "tsx": "^4.20.5"
  }
}
```

- [ ] **Step 2: Write failing portfolio tests**

```typescript
import { buildPortfolio, eligibleMonths } from "./firePortfolio";

const intersect = (left: readonly string[], right: readonly string[]) =>
  left.filter((month) => right.includes(month));

const assertDeepEqual = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
};

assertDeepEqual(
  eligibleMonths([
    { category: "BR_EQUITY", series: "IBOV", weight: 0.999, constrainsSample: true },
    { category: "GLOBAL_EQUITY", series: "VT", weight: 0.001, constrainsSample: true },
  ]),
  intersect(FIRE_RETURN_SERIES.IBOV.months, FIRE_RETURN_SERIES.VT.months),
  "a 0.1% included holding restricts the sample",
);

assertDeepEqual(
  buildPortfolio(allocation, {
    ...DEFAULT_FIRE_PREFERENCES,
    excluded_return_categories: ["GLOBAL_EQUITY"],
  }),
  [
    { category: "BR_EQUITY", series: "IBOV", weight: 0.999, constrainsSample: true },
    { category: "GLOBAL_EQUITY", series: "CASH", weight: 0.001, constrainsSample: false },
  ],
  "excluded value remains weighted but receives cash return",
);
```

Also assert selector mappings `SPY/VTI`, `VT/VWRL`, and `BTC/CMBI10`; zero totals disappear; cash never constrains; and the displayed period comes from the first/last intersected month.

- [ ] **Step 3: Write failing deterministic sampling tests**

```typescript
const assertEqual = (actual: string, expected: string, message: string) => {
  if (actual !== expected) throw new Error(`${message}: ${actual} != ${expected}`);
};

const sequenceRng = (values: readonly number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};

const monthsFrom = (first: string, last: string): string[] => {
  const result: string[] = [];
  let [year, month] = first.split("-").map(Number);
  const [lastYear, lastMonth] = last.split("-").map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) { year += 1; month = 1; }
  }
  return result;
};

assertDeepEqual(
  sampleMonthKeys({
    eligible: ["2008-01", "2008-02", "2008-03"],
    method: "independent_months",
    count: 3,
    rng: sequenceRng([0, 0.99, 0.34]),
  }),
  ["2008-01", "2008-03", "2008-02"],
  "independent sampling draws aligned months",
);

assertEqual(
  sampleMonthKeys({
    eligible: monthsFrom("2008-01", "2009-12"),
    method: "contiguous_12_month_blocks",
    count: 12,
    rng: () => 0,
  }).join(","),
  monthsFrom("2008-01", "2008-12").join(","),
  "block sampling preserves a complete historical year",
);
```

- [ ] **Step 4: Run the tests and verify failure**

Run: `yarn --cwd ../react test:fire`

Expected: missing generalized portfolio and sampler functions.

- [ ] **Step 5: Implement category resolution and month-indexed return lookup**

```typescript
import type { FirePlanningPreferences } from "../Planning/api";
import type { FireReturnSeriesKey, ReturnCategory } from "./fireReturnTypes";

export type PortfolioSlice = {
  category: ReturnCategory | "CASH";
  series: FireReturnSeriesKey;
  weight: number;
  constrainsSample: boolean;
};

const selectableSeries = {
  US_EQUITY: (p: Required<FirePlanningPreferences>) => p.us_equity_proxy,
  GLOBAL_EQUITY: (p: Required<FirePlanningPreferences>) => p.global_equity_proxy,
  CRYPTO: (p: Required<FirePlanningPreferences>) => p.crypto_proxy,
} as const;

export const returnForMonth = (slice: PortfolioSlice, month: string): number => {
  const data = FIRE_RETURN_SERIES[slice.series];
  const index = data.months.indexOf(month);
  if (index < 0) throw new Error(`${slice.series} has no return for ${month}`);
  return data.realReturns[index];
};
```

For excluded categories, retain the original weight, set `series: "CASH"`, and set `constrainsSample: false`. Normalize every non-zero bucket by total patrimony, including cash.

- [ ] **Step 6: Preserve the age-in-bonds semantics with richer slices**

`buildAgeInBondsPortfolio` must keep the current cash fraction unchanged, scale owned variable-income slices proportionally within the remaining invested fraction, and scale owned fixed-income slices proportionally. If there is no owned fixed-income slice, create one `IMA_GERAL_EX_C` slice for the hypothetical fixed sleeve. Excluded slices keep cash returns and participate in their original variable/fixed side without redistributing their internal share.

```typescript
export type PortfolioAtFn = (yearIndex: number) => readonly PortfolioSlice[];

export const buildAgeInBondsPortfolio = (
  base: readonly PortfolioSlice[],
  stockFraction: number,
): PortfolioSlice[] => {
  const cash = base.filter((slice) => slice.category === "CASH");
  const variable = base.filter(
    (slice) => slice.category !== "CASH" && !slice.category.startsWith("FIXED_"),
  );
  const fixed = base.filter((slice) => slice.category.startsWith("FIXED_"));
  const cashWeight = cash.reduce((sum, slice) => sum + slice.weight, 0);
  const investedWeight = 1 - cashWeight;
  const variableBase = variable.length
    ? variable
    : [{ category: "BR_EQUITY", series: "IBOV", weight: 1, constrainsSample: true }];
  const fixedBase = fixed.length
    ? fixed
    : [{ category: "FIXED_SELIC", series: "IMA_GERAL_EX_C", weight: 1, constrainsSample: true }];
  const scale = (slices: readonly PortfolioSlice[], target: number) => {
    const current = slices.reduce((sum, slice) => sum + slice.weight, 0);
    return slices.map((slice) => ({ ...slice, weight: target * slice.weight / current }));
  };
  return [
    ...cash,
    ...scale(variableBase, investedWeight * stockFraction),
    ...scale(fixedBase, investedWeight * (1 - stockFraction)),
  ];
};
```

- [ ] **Step 7: Replace hard-coded return blending in every bootstrap path**

```typescript
const drawPortfolioMonthReturn = (
  portfolio: readonly PortfolioSlice[],
  month: string,
): number =>
  portfolio.reduce(
    (sum, slice) => sum + slice.weight * returnForMonth(slice, month),
    0,
  );
```

Use one sampled calendar month for all slices in a simulated month. Materialize eligible months or block starts once per static portfolio/year. Keep fixed seed, number of trials, monthly contribution timing, monthly withdrawal timing, percentile bands, and safe-rate search unchanged.

- [ ] **Step 8: Run engine tests and the full React build**

Run: `yarn --cwd ../react test:fire`

Run: `yarn --cwd ../react build`

Expected: tests and build pass; deterministic legacy-equivalent IBOV/IFIX/CDI portfolios retain the existing result shape.

- [ ] **Step 9: Commit only after explicit authorization**

```bash
git add react/package.json react/yarn.lock react/src/pages/private/Home/firePortfolio.ts react/src/pages/private/Home/firePortfolio.test.ts react/src/pages/private/Home/fireBootstrap.ts react/src/pages/private/Home/fireBootstrap.test.ts
git commit -m "feat: generalize FIRE historical sampling"
```

---

### Task 7: Add the compact proxy/history controls and wire all FIRE consumers

**Files:**
- Create: `react/src/pages/private/Planning/FireHistoricalDataControls.tsx`
- Create: `react/src/pages/private/Planning/FireHistoricalDataControls.test.tsx`
- Create: `react/src/test/setup.ts`
- Modify: `react/vite.config.ts`
- Modify: `react/src/pages/private/Planning/strategies/FireDetail.tsx`
- Modify: `react/src/pages/private/Planning/PlanningHub.tsx`
- Modify: `react/src/pages/private/Home/Indicators.tsx`
- Modify: `react/src/pages/private/Home/ConstantDollarIndicator.tsx`
- Modify: `react/src/pages/private/Home/ConstantDollarAgeInBondsIndicator.tsx`
- Modify: `react/src/pages/private/Home/FireSimulationResults.tsx`
- Modify: `react/src/pages/private/Assets/consts.ts`
- Modify: `react/src/consts.js`
- Modify: `react/src/pages/private/Assets/Table/TopToolbar/utils.ts`
- Modify: `react/src/pages/private/Transactions/components/NewTransactionDrawer/NewTransactionForm.tsx`
- Modify: `react/src/pages/private/Incomes/components/CreateOrEditIncomeDrawer/CreateOrEditIncomeForm.tsx`
- Modify: `react/package.json`

**Interfaces:**
- `FireHistoricalDataControls` receives allocation, local FIRE preferences, and field-level callbacks.
- Both constant-dollar indicators receive `portfolio`, `samplingMethod`, and optional `portfolioAt` rather than the old equity/IFIX/fixed totals.
- Saving `/planning/fire` persists all FIRE proxy/sampling/exclusion choices in the existing preference patch.

- [ ] **Step 1: Add React component testing support and write failing UI tests**

Add exact dev dependencies and the focused component-test script:

```json
{
  "scripts": {
    "test:components": "vitest src/pages/private/Planning/FireHistoricalDataControls.test.tsx"
  },
  "devDependencies": {
    "jsdom": "^26.1.0",
    "vitest": "^3.2.4"
  }
}
```

Configure the existing Vite file and test setup:

```typescript
// vite.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts" },
  server: { port: 3000, host: true },
  build: { outDir: "build" },
});
```

```typescript
// src/test/setup.ts
import "@testing-library/jest-dom/vitest";
```

Test the approved surface:

```tsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

render(
  <FireHistoricalDataControls
    allocation={[
      { category: "BR_EQUITY", series: "IBOV", total: 900_000 },
      { category: "GLOBAL_EQUITY", series: null, total: 99_000 },
      { category: "CRYPTO", series: null, total: 1_000 },
      { category: "CASH", series: "CASH", total: 50_000 },
    ]}
    preferences={{ ...DEFAULT_FIRE_PREFERENCES, global_equity_proxy: "VT" }}
    onChange={vi.fn()}
  />,
);

expect(screen.getByText("Renda variável BR")).toBeInTheDocument();
expect(screen.getByDisplayValue("VT")).toBeInTheDocument();
expect(screen.getByText(/Período resultante:/)).toHaveTextContent("2008");
expect(screen.queryByText("Caixa")).not.toBeInTheDocument();
expect(screen.queryByText("Renda variável EUA")).not.toBeInTheDocument();
```

Add interaction assertions that changing VT to VWRL immediately changes the period, unchecking Crypto adds `CRYPTO` to exclusions without changing patrimony, and a short period shows a warning rather than disabling calculation.

- [ ] **Step 2: Run the component test and verify failure**

Run: `yarn --cwd ../react test:components --run`

Expected: the component and test configuration do not exist.

- [ ] **Step 3: Implement the compact historical-data list**

Render only owned non-cash categories. Variable selector options and explanatory copy are:

```typescript
const PROXY_OPTIONS = {
  US_EQUITY: [
    { value: "SPY", label: "SPY", detail: "S&P 500; histórico mais longo" },
    { value: "VTI", label: "VTI", detail: "mercado americano mais amplo" },
  ],
  GLOBAL_EQUITY: [
    { value: "VT", label: "VT", detail: "global all-cap, incluindo small caps" },
    { value: "VWRL", label: "VWRL/VWRA", detail: "large/mid-cap, mais próximo de VWRA" },
  ],
  CRYPTO: [
    { value: "BTC", label: "Bitcoin", detail: "ativo único; histórico mais longo" },
    { value: "CMBI10", label: "CMBI 10", detail: "cesta diversificada; histórico mais curto" },
  ],
};
```

Fixed-income rows show their derived `series` as plain text. If one semantic fixed category has multiple maturity buckets, render one inclusion checkbox for the category and list the derived proxies together, such as `IMA-B 5 + IMA-B 5+`. The row history starts at the latest first month among those proxies. Cash remains absent.

Update the shared asset mappings so users can create, edit, filter, transact, and record income for global holdings:

```typescript
export const AssetsTypesMapping = {
  "Renda variável BR": { value: "STOCK", color: "#cc6cc8" },
  "Renda variável EUA": { value: "STOCK_USA", color: "#906ccc" },
  "Renda variável Global": { value: "EQUITY_GLOBAL", color: "#7b76d8" },
  Cripto: { value: "CRYPTO", color: "#ccc86c" },
  FII: { value: "FII", color: "#6cccc6" },
  "Renda fixa BR": { value: "FIXED_BR", color: "#d9a648" },
};
```

In both legacy `src/consts.js` currency mapping and `getCurrencyFromType`, map `EQUITY_GLOBAL` to USD. In transaction conversion-rate validation, treat `EQUITY_GLOBAL` exactly like `STOCK_USA`. Add it to the income asset-type filter. Rename all remaining user-facing `Ação BR` and `Ação EUA` keys to the approved `Renda variável BR` and `Renda variável EUA` labels.

- [ ] **Step 4: Wire FireDetail local state and persistence**

Replace the asset-report and bank-summary composition used only by FIRE with `useFireAllocation()`. Initialize and synchronize local proxy, exclusion, and sampling state from `getFirePlanningPreferences()`. Include all five approved keys in `isDirty` and `handleSave`:

```typescript
fire: {
  withdrawal_rate: withdrawalRate,
  target_years: targetYears,
  monthly_expenses_override: expensesOverride,
  sampling_method: samplingMethod,
  us_equity_proxy: usEquityProxy,
  global_equity_proxy: globalEquityProxy,
  crypto_proxy: cryptoProxy,
  excluded_return_categories: excludedReturnCategories,
}
```

Place the persisted `Preservar sequências históricas de 12 meses` switch beside withdrawal rate and retirement duration. Place `FireHistoricalDataControls` below the primary settings and above simulation results.

- [ ] **Step 5: Update indicator contracts without changing unrelated presentation**

Build one portfolio from the allocation and local preferences, pass it into the static indicator, and create `portfolioAt(yearIndex)` for age in bonds. Remove the IFIX-only checkbox/disclosure and old `equityTotal`, `ifixTotal`, and `fixedIncomeTotal` simulation props. Keep patrimony sliders, expense override, savings, FIRE target, progress, verdict wording, charts, and result cards unchanged.

Use the persisted preferences and fetched allocation in compact `PlanningHub` and `Home/Indicators`; compact views do not render proxy controls but must simulate with the same saved model.

- [ ] **Step 6: Run UI tests and compile the application**

Run: `yarn --cwd ../react test:components --run`

Run: `yarn --cwd ../react test:fire`

Run: `yarn --cwd ../react build`

Expected: all commands pass and no consumer still references `exclude_ifix_from_sim` or the three-bucket return inputs.

- [ ] **Step 7: Perform the focused browser verification**

At `/planning/fire`, verify:

1. Only owned categories appear.
2. VT is initially selected for global holdings and changing it updates the period immediately.
3. Excluding a 0.1% category removes it from the intersection but leaves FIRE patrimony/progress unchanged.
4. Cash affects returns but is absent from the list.
5. Saving, reloading, and visiting the compact planning/home indicator retains the same model.
6. Age in bonds uses the same selected proxies and fallback fixed-income series.

- [ ] **Step 8: Commit only after explicit authorization**

```bash
git add react
git commit -m "feat: add FIRE proxy and history controls"
```

---

### Task 8: Backfill the small user set and install final database constraints

**Files:**
- Create: `django/variable_income_assets/migrations/0031_asset_fixed_income_constraints.py`
- Modify: `django/variable_income_assets/tests/e2e/test_asset_endpoints.py`
- Modify: `django/variable_income_assets/tests/test__fire_allocation.py`

**Interfaces:**
- Requires: every existing fixed-income `Asset` and `AssetReadModel` has a supported indexer, and global ETF holdings have been reclassified.
- Produces: database-level invariants matching serializer/domain validation.

- [ ] **Step 1: Audit the rows that require manual backfill**

Run in Django shell:

```python
from variable_income_assets.models import Asset

list(
    Asset.objects.filter(type="FIXED_BR", indexer="")
    .values("id", "user_id", "code", "description", "maturity_date")
)
list(
    Asset.objects.filter(type="STOCK_USA", code__in=["VT", "VWRA", "VWRL"])
    .values("id", "user_id", "code", "type")
)
```

Expected: a small, reviewable list; do not infer unknown indexers from descriptions.

- [ ] **Step 2: Apply the product-owner-reviewed shell assignments**

Use explicit primary-key assignments supplied during the joint backfill session:

```python
from variable_income_assets.models import Asset
from variable_income_assets.service_layer.tasks.cqrs import upsert_asset_read_model

for asset_id, indexer in reviewed_indexer_assignments:
    Asset.objects.filter(pk=asset_id).update(indexer=indexer)
    upsert_asset_read_model(asset_id, is_aggregate_upsert=False)

for asset_id in reviewed_global_asset_ids:
    Asset.objects.filter(pk=asset_id).update(type="EQUITY_GLOBAL")
    upsert_asset_read_model(asset_id, is_aggregate_upsert=False)
```

During the joint shell session, define `reviewed_indexer_assignments` and `reviewed_global_asset_ids` directly from the rows reviewed in Step 1. They are intentionally runtime inputs supplied by the product owner, not inferred or encoded in a migration.

- [ ] **Step 3: Write failing database-constraint tests**

```python
@pytest.mark.django_db(transaction=True)
def test__database_rejects_fixed_income_without_indexer(user):
    with pytest.raises(IntegrityError):
        Asset.objects.create(
            user=user,
            code="INVALID-RF",
            type="FIXED_BR",
            currency="BRL",
            indexer="",
        )


@pytest.mark.django_db(transaction=True)
def test__database_rejects_non_fixed_income_facts(user):
    with pytest.raises(IntegrityError):
        Asset.objects.create(
            user=user,
            code="BBAS3",
            type="STOCK",
            currency="BRL",
            indexer="CDI",
        )
```

- [ ] **Step 4: Run the constraint tests and verify failure**

Run: `uv run pytest variable_income_assets/tests/e2e/test_asset_endpoints.py -q`

Expected: direct ORM writes still permit invalid combinations.

- [ ] **Step 5: Add final canonical-asset constraints and generate migration**

```python
models.CheckConstraint(
    condition=~models.Q(type=AssetTypes.fixed_br) | models.Q(
        indexer__in=(
            FixedIncomeIndexers.cdi,
            FixedIncomeIndexers.selic,
            FixedIncomeIndexers.ipca,
            FixedIncomeIndexers.prefixed,
        )
    ),
    name="fixed_br_requires_supported_indexer",
),
models.CheckConstraint(
    condition=(
        ~models.Q(type=AssetTypes.fixed_br)
        | ~models.Q(indexer__in=(FixedIncomeIndexers.ipca, FixedIncomeIndexers.prefixed))
        | models.Q(maturity_date__isnull=False)
    ),
    name="duration_indexer_requires_maturity",
),
models.CheckConstraint(
    condition=(
        models.Q(type=AssetTypes.fixed_br)
        | models.Q(indexer="", liquidity_type="", maturity_date__isnull=True)
    ),
    name="non_fixed_has_no_fixed_income_facts",
),
```

Run: `uv run python manage.py makemigrations variable_income_assets --name asset_fixed_income_constraints`

Expected: migration `0031` adds only the three constraints; it contains no data migration.

- [ ] **Step 6: Verify migrations and the complete affected test set**

Run: `uv run python manage.py migrate --plan`

Run: `uv run pytest authentication/tests/test__user__views.py variable_income_assets/tests/test__fire_allocation.py variable_income_assets/tests/test__fire_returns.py variable_income_assets/tests/test_scripts.py variable_income_assets/tests/e2e/test_asset_endpoints.py variable_income_assets/tests/integrations/test__b3_handlers.py variable_income_assets/tests/tasks/test__cqrs.py -q`

Run: `yarn --cwd ../react test:fire`

Run: `yarn --cwd ../react test:components --run`

Run: `yarn --cwd ../react build`

Expected: migration plan is phase one then phase two, and every command passes.

- [ ] **Step 7: Commit only after explicit authorization**

```bash
git add django/variable_income_assets/migrations/0031_asset_fixed_income_constraints.py django/variable_income_assets/tests
git commit -m "feat: enforce FIRE asset classification"
```

---

## Final Verification

- [ ] Run backend formatting and lint: `uv run ruff check .`
- [ ] Run the full backend suite: `uv run pytest -q`
- [ ] Run FIRE TypeScript tests: `yarn --cwd ../react test:fire`
- [ ] Run FIRE component tests: `yarn --cwd ../react test:components --run`
- [ ] Run frontend lint: `yarn --cwd ../react lint`
- [ ] Run the production frontend build: `yarn --cwd ../react build`
- [ ] Regenerate `fireReturns.ts` once with official live sources and inspect series coverage before enabling selectors.
- [ ] Confirm no live network request is made while loading `/planning/fire`.
- [ ] Confirm `current_currency_conversion_rate` remains untouched by simulation code.
- [ ] Confirm FIRE patrimony and progress do not change when a category is excluded.
- [ ] Confirm no hidden exposure threshold remains in the bootstrap engine.
