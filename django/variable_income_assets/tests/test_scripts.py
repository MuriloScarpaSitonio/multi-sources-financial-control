import base64
import json
import urllib.error
from decimal import Decimal

import pytest

from variable_income_assets import scripts
from variable_income_assets.fire_returns import (
    FIRE_RETURN_SERIES_KEYS,
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
