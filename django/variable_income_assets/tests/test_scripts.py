import base64
import json
import urllib.error
from datetime import date
from decimal import Decimal

import pytest

from variable_income_assets import fire_returns as fire_returns_module
from variable_income_assets import scripts
from variable_income_assets.choices import (
    AssetObjectives,
    AssetTypes,
    Currencies,
    FixedIncomeIndexers,
    LiquidityTypes,
    PassiveIncomeTypes,
    TransactionActions,
)
from variable_income_assets.fire_returns import (
    FIRE_RETURN_SERIES_KEYS,
    cash_real_returns,
    foreign_to_brl_returns,
    normalize_foreign_real_returns,
    render_fire_returns_ts,
    to_real_returns,
    validate_fire_return_series,
)
from variable_income_assets.fire_returns import (
    sources as fire_return_sources,
)
from variable_income_assets.fire_returns.sources import (
    ETF_SYMBOLS,
    close_levels_to_returns,
    daily_levels_to_monthly_returns,
    fetch_alpha_vantage_adjusted_monthly,
    fetch_anbima_ima_monthly,
    fetch_b3_index_monthly,
    fetch_bcb_sgs_monthly,
    fetch_coin_metrics_asset_monthly,
    fetch_coin_metrics_index_monthly,
    fetch_ima_monthly,
    fetch_json,
    parse_anbima_ima_snapshot,
)
from variable_income_assets.models import AssetReadModel, PassiveIncome, Transaction
from variable_income_assets.service_layer.tasks import upsert_asset_read_model
from variable_income_assets.tests.conftest import (
    AssetFactory,
    AssetMetaDataFactory,
    TransactionFactory,
)


def test__close_levels_to_returns_does_not_fill_missing_months():
    assert close_levels_to_returns(
        {"2020-01": Decimal("100"), "2020-03": Decimal("110")}
    ) == {"2020-03": Decimal("0.1")}


def test__daily_levels_use_last_available_day_of_each_month():
    result = daily_levels_to_monthly_returns(
        [
            {"time": "2020-01-30T00:00:00Z", "level": "100"},
            {"time": "2020-01-31T00:00:00Z", "level": "105"},
            {"time": "2020-02-28T00:00:00Z", "level": "115.5"},
        ],
        value_field="level",
    )
    assert result == {"2020-02": Decimal("0.1")}


def test__fetch_json_retries_transient_http_errors(monkeypatch):
    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def read(self):
            return b'{"ok": true}'

    responses = iter(
        (
            urllib.error.HTTPError("https://example.test", 502, "Bad Gateway", {}, None),
            Response(),
        )
    )

    def fake_urlopen(request, timeout):
        response = next(responses)
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr(fire_return_sources.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(fire_return_sources.time, "sleep", lambda seconds: None)

    assert fetch_json("https://example.test") == {"ok": True}


def test__fetch_b3_index_monthly_preserves_payload_and_normalizes_ibov(monkeypatch):
    calls = []

    def fake_fetch_json(url, params=None):
        calls.append((url, params))
        payload = json.loads(base64.b64decode(url.rsplit("/", 1)[1]))
        year = payload["year"]
        value = {1996: "20000", 1997: "3000"}[year]
        return {"results": [{"day": "31", "rateValue12": value}]}

    monkeypatch.setattr(fire_return_sources, "fetch_json", fake_fetch_json)

    assert fetch_b3_index_monthly("IBOV", 1997, 1997) == {
        "1997-12": Decimal("0.5")
    }
    first_payload = json.loads(base64.b64decode(calls[0][0].rsplit("/", 1)[1]))
    assert first_payload == {"language": "en-us", "index": "IBOV", "year": 1996}


def test__fetch_b3_index_monthly_accepts_null_results_before_index_existed(monkeypatch):
    monkeypatch.setattr(
        fire_return_sources,
        "fetch_json",
        lambda url, params=None: {"results": None},
    )

    assert fetch_b3_index_monthly("IFIX", 1995, 1995) == {}


def test__fetch_bcb_sgs_monthly_parses_percentage_rows(monkeypatch):
    monkeypatch.setattr(
        fire_return_sources,
        "fetch_json",
        lambda url, params=None: [
            {"data": "01/01/2020", "valor": "1,25"},
            {"data": "01/02/2020", "valor": "0.50"},
        ],
    )

    assert fetch_bcb_sgs_monthly(4391, 2020, 2020) == {
        "2020-01": Decimal("0.0125"),
        "2020-02": Decimal("0.005"),
    }


def test__fetch_bcb_daily_levels_in_ten_year_chunks(monkeypatch):
    calls = []

    def fake_fetch_json(url, params=None):
        calls.append(params)
        return []

    monkeypatch.setattr(fire_return_sources, "fetch_json", fake_fetch_json)

    fetch_bcb_sgs_monthly(12462, 1995, 2023)

    assert [
        (call["dataInicial"], call["dataFinal"]) for call in calls
    ] == [
        ("01/01/1994", "31/12/2003"),
        ("01/01/2004", "31/12/2013"),
        ("01/01/2014", "31/12/2023"),
    ]


def test__fetch_bcb_daily_levels_skips_chunks_before_series_existed(monkeypatch):
    def fake_fetch_json(url, params=None):
        if params["dataFinal"] == "31/12/2003":
            raise urllib.error.HTTPError(url, 404, "Not Found", {}, None)
        return [
            {"data": "30/01/2004", "valor": "100,00"},
            {"data": "27/02/2004", "valor": "110,00"},
        ]

    monkeypatch.setattr(fire_return_sources, "fetch_json", fake_fetch_json)

    assert fetch_bcb_sgs_monthly(12462, 1995, 2005) == {
        "2004-02": Decimal("0.1")
    }


def test__fetch_alpha_vantage_uses_adjusted_monthly_closes(monkeypatch):
    observed = {}

    def fake_fetch_json(url, params=None):
        observed.update(url=url, params=params)
        return {
            "Monthly Adjusted Time Series": {
                "2020-02-28": {"5. adjusted close": "110"},
                "2020-01-31": {"5. adjusted close": "100"},
            }
        }

    monkeypatch.setattr(fire_return_sources, "fetch_json", fake_fetch_json)

    assert fetch_alpha_vantage_adjusted_monthly("VT", "secret") == {
        "2020-02": Decimal("0.1")
    }
    assert observed["params"]["function"] == "TIME_SERIES_MONTHLY_ADJUSTED"
    assert observed["params"]["apikey"] == "secret"


def test__vwrl_proxy_uses_the_usd_trading_line():
    assert ETF_SYMBOLS["VWRL"] == "VWRD.LON"


def test__fetch_alpha_vantage_retries_free_key_burst_limit(monkeypatch):
    responses = iter(
        (
            {
                "Information": (
                    "Please consider spreading out your free API requests more "
                    "sparingly (1 request per second)."
                )
            },
            {
                "Monthly Adjusted Time Series": {
                    "2020-02-28": {"5. adjusted close": "110"},
                    "2020-01-31": {"5. adjusted close": "100"},
                }
            },
        )
    )
    monkeypatch.setattr(fire_return_sources.time, "sleep", lambda seconds: None)
    monkeypatch.setattr(
        fire_return_sources,
        "fetch_json",
        lambda url, params=None: next(responses),
    )

    assert fetch_alpha_vantage_adjusted_monthly("VTI", "secret") == {
        "2020-02": Decimal("0.1")
    }


def test__fetch_coin_metrics_asset_uses_community_price_archive(monkeypatch):
    observed = {}

    def fake_fetch_text(url):
        observed["url"] = url
        return "time,PriceUSD\n2020-01-31,100\n2020-02-29,120\n"

    monkeypatch.setattr(fire_return_sources, "fetch_text", fake_fetch_text)

    assert fetch_coin_metrics_asset_monthly("btc", 2020, 2020) == {
        "2020-02": Decimal("0.2")
    }
    assert observed["url"] == (
        "https://raw.githubusercontent.com/coinmetrics/data/master/csv/btc.csv"
    )


def test__fetch_coin_metrics_index_uses_public_index_history(monkeypatch):
    observed = {}

    def fake_fetch_json(url, params=None):
        observed.update(url=url, params=params)
        return {
            "daily": [
                {"iso_date": "2020-01-31", "close": 100},
                {"iso_date": "2020-02-29", "close": 120},
            ]
        }

    monkeypatch.setattr(fire_return_sources, "fetch_json", fake_fetch_json)

    assert fetch_coin_metrics_index_monthly("CMBI10", 2017, 2025) == {
        "2020-02": Decimal("0.2")
    }
    assert observed == {
        "url": "https://indexes.coinmetrics.io/api/historical-data",
        "params": {
            "index": "CMBI10",
            "start_time": "2016-12-01",
            "end_time": "2025-12-31",
            "timezone": "America/New_York",
        },
    }


def test__parse_anbima_snapshot_reads_public_txt_totals():
    payload = (
        "1@Índice@Data de Referência@Número Índice\r\n"
        "1@IRF-M 1@31/08/2026@20.864,457071\r\n"
        "1@IMA-B 5+@31/08/2026@12.695,966347\r\n"
    ).encode("latin-1")

    assert parse_anbima_ima_snapshot(payload) == {
        "IRF-M 1": Decimal("20864.457071"),
        "IMA-B 5+": Decimal("12695.966347"),
    }


def test__fetch_anbima_monthly_includes_prior_month_level(monkeypatch):
    monkeypatch.setattr(
        fire_return_sources,
        "_fetch_anbima_snapshot",
        lambda refdate: {"IMA-S": Decimal(refdate.toordinal())},
    )

    result = fetch_anbima_ima_monthly("IMA-S", 2024, 2024)

    assert min(result) == "2024-01"
    assert max(result) == "2024-12"
    assert len(result) == 12


def test__fetch_ima_monthly_hands_off_from_bcb_to_anbima(monkeypatch):
    monkeypatch.setattr(
        fire_return_sources,
        "fetch_bcb_sgs_monthly",
        lambda *args, **kwargs: {
            "2023-05": Decimal("0.01"),
            "2023-06": Decimal("0.02"),
        },
    )
    monkeypatch.setattr(
        fire_return_sources,
        "fetch_anbima_ima_monthly",
        lambda *args, **kwargs: {
            "2023-05": Decimal("0.03"),
            "2023-06": Decimal("0.04"),
        },
    )

    assert fetch_ima_monthly("IRF-M 1", 2023, 2023) == {
        "2023-05": Decimal("0.01"),
        "2023-06": Decimal("0.04"),
    }


def test__fetch_ima_b_5_plus_uses_bcb_history(monkeypatch):
    requested_series = []

    def fake_fetch_bcb(series_id, *args, **kwargs):
        requested_series.append(series_id)
        return {"2004-05": Decimal("0.01")}

    monkeypatch.setattr(
        fire_return_sources,
        "fetch_bcb_sgs_monthly",
        fake_fetch_bcb,
    )
    monkeypatch.setattr(
        fire_return_sources,
        "fetch_anbima_ima_monthly",
        lambda *args, **kwargs: {},
    )

    assert fetch_ima_monthly("IMA-B 5+", 2004, 2004) == {
        "2004-05": Decimal("0.01")
    }
    assert requested_series == [12468]


def test_generate_fire_returns_ts_renders_built_series(tmp_path, monkeypatch):
    monkeypatch.setenv("ALPHA_VANTAGE_API_KEY", "secret")
    monkeypatch.setattr(
        scripts,
        "build_fire_return_series",
        lambda **kwargs: {
            key: {"2020-01": Decimal("0.1")} for key in FIRE_RETURN_SERIES_KEYS
        },
    )
    output = tmp_path / "fireReturns.ts"

    scripts.generate_fire_returns_ts(output_path=str(output), start_year=2020, end_year=2020)

    assert 'IBOV: { label: "IBOV", months: ["2020-01"]' in output.read_text()


def test_generate_fire_returns_ts_rejects_pre_1995_start_year(monkeypatch):
    monkeypatch.setenv("ALPHA_VANTAGE_API_KEY", "secret")
    with pytest.raises(ValueError, match="start_year >= 1995"):
        scripts.generate_fire_returns_ts(output_path=None, start_year=1994, end_year=1995)


def test__public_interface_exposes_return_series_builder():
    assert callable(getattr(fire_returns_module, "build_fire_return_series", None))


def test__foreign_total_return_is_converted_to_brl_then_deflated():
    result = normalize_foreign_real_returns(
        foreign_total_returns={"2020-01": Decimal("0.10")},
        usd_brl_returns={"2020-01": Decimal("0.05")},
        ipca_returns={"2020-01": Decimal("0.02")},
    )

    assert result["2020-01"] == pytest.approx(Decimal("0.1323529412"))


def test__foreign_conversion_and_deflation_drop_unaligned_months():
    converted = foreign_to_brl_returns(
        {"2020-01": Decimal("0.10"), "2020-02": Decimal("0.20")},
        {"2020-01": Decimal("0.05")},
    )
    real = to_real_returns(
        converted,
        {"2020-01": Decimal("0.02"), "2020-03": Decimal("0.01")},
    )

    assert converted == {"2020-01": Decimal("0.1550")}
    assert set(real) == {"2020-01"}


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


def test__series_integrity_requires_every_non_empty_series():
    complete = {key: {"2020-01": Decimal("0.01")} for key in FIRE_RETURN_SERIES_KEYS}

    validate_fire_return_series(complete)

    with pytest.raises(ValueError, match="Missing FIRE return series: CASH"):
        validate_fire_return_series(
            {key: value for key, value in complete.items() if key != "CASH"}
        )

    with pytest.raises(ValueError, match="FIRE return series CASH is empty"):
        validate_fire_return_series({**complete, "CASH": {}})


def _fixed_asset(user, *, code: str):
    assert user.id == 1
    asset = AssetFactory(
        code=code,
        description="Test fixed income",
        type=AssetTypes.fixed_br,
        currency=Currencies.real,
        objective=AssetObjectives.growth,
        user=user,
        liquidity_type=LiquidityTypes.at_maturity,
        maturity_date=date(2026, 12, 21),
        indexer="",
    )
    AssetMetaDataFactory(
        code=code,
        type=AssetTypes.fixed_br,
        currency=Currencies.real,
        current_price=Decimal("0.01"),
    )
    return asset


@pytest.mark.django_db
def test_fixed_income_facts_backfill_is_dry_run_by_default_and_updates_read_model(
    monkeypatch, user
):
    asset = _fixed_asset(user, code="CDBTEST")
    upsert_asset_read_model(asset_id=asset.id)
    monkeypatch.setattr(
        scripts,
        "_USER_1_FIXED_INCOME_FACTS",
        {"CDBTEST": {"indexer": FixedIncomeIndexers.cdi}},
    )

    dry_run_report = scripts.backfill_user_1_fixed_income_facts()

    asset.refresh_from_db()
    assert asset.indexer == ""
    assert dry_run_report[0]["changes"] == {"indexer": {"from": "", "to": "CDI"}}

    scripts.backfill_user_1_fixed_income_facts(dry_run=False)

    asset.refresh_from_db()
    assert asset.indexer == FixedIncomeIndexers.cdi
    assert AssetReadModel.objects.get(write_model_pk=asset.id).indexer == FixedIncomeIndexers.cdi


@pytest.mark.django_db
def test_fixed_income_event_backfill_is_dry_run_by_default_and_idempotent(monkeypatch, user):
    asset = _fixed_asset(user, code="25L03967955")
    TransactionFactory(
        asset=asset,
        action=TransactionActions.buy,
        operation_date=date(2025, 12, 26),
        quantity=Decimal("1000000"),
        price=Decimal("0.01"),
    )
    upsert_asset_read_model(asset_id=asset.id)
    monkeypatch.setattr(
        scripts,
        "_USER_1_FIXED_INCOME_TRANSACTIONS",
        (
            {
                "code": asset.code,
                "action": TransactionActions.sell,
                "operation_date": date(2026, 6, 29),
                "quantity": Decimal("1000000"),
                "price": Decimal("0.01"),
            },
        ),
    )
    monkeypatch.setattr(
        scripts,
        "_USER_1_FIXED_INCOME_INTERESTS",
        (
            {
                "code": asset.code,
                "operation_date": date(2026, 6, 29),
                "amount": Decimal("628.16"),
            },
        ),
    )

    dry_run_report = scripts.backfill_user_1_fixed_income_events()

    assert {item["action"] for item in dry_run_report} == {
        "income_created",
        "transaction_created",
    }
    assert not Transaction.objects.filter(asset=asset, action=TransactionActions.sell).exists()
    assert not PassiveIncome.objects.filter(asset=asset).exists()

    scripts.backfill_user_1_fixed_income_events(dry_run=False)
    second_report = scripts.backfill_user_1_fixed_income_events(dry_run=False)

    assert Transaction.objects.filter(asset=asset, action=TransactionActions.sell).count() == 1
    income = PassiveIncome.objects.get(asset=asset)
    assert income.type == PassiveIncomeTypes.interest
    assert income.amount == Decimal("628.16")
    assert {item["action"] for item in second_report} == {
        "income_already_exists",
        "transaction_already_exists",
    }


@pytest.mark.django_db
def test_fixed_income_event_backfill_recognizes_existing_maturity_with_different_price(
    monkeypatch, user
):
    asset = _fixed_asset(user, code="25H03552378")
    TransactionFactory(
        asset=asset,
        action=TransactionActions.buy,
        operation_date=date(2025, 8, 18),
        quantity=Decimal("1000000"),
        price=Decimal("0.01"),
    )
    TransactionFactory(
        asset=asset,
        action=TransactionActions.sell,
        operation_date=date(2026, 2, 19),
        quantity=Decimal("1000000"),
        price=Decimal("0.01064189"),
    )
    upsert_asset_read_model(asset_id=asset.id)
    monkeypatch.setattr(
        scripts,
        "_USER_1_FIXED_INCOME_TRANSACTIONS",
        (
            {
                "code": asset.code,
                "action": TransactionActions.sell,
                "operation_date": date(2026, 2, 19),
                "quantity": Decimal("1000000"),
                "price": Decimal("0.01"),
            },
        ),
    )
    monkeypatch.setattr(scripts, "_USER_1_FIXED_INCOME_INTERESTS", ())

    report = scripts.backfill_user_1_fixed_income_events()

    assert report[0]["action"] == "transaction_already_exists"
    assert Transaction.objects.filter(asset=asset, action=TransactionActions.sell).count() == 1
