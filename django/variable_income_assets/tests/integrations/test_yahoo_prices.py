import re
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from aioresponses import aioresponses
from asgiref.sync import async_to_sync

from ...integrations.helpers import get_stocks_usa_close_prices, get_stocks_usa_prices


def chart_url(symbol):
    return re.compile(
        r"https://query1\.finance\.yahoo\.com/v8/finance/chart/" + re.escape(symbol) + r"\?.*"
    )


def chart(symbol, currency="USD", exchange="NMS", **fields):
    meta = {
        "symbol": symbol,
        "currency": currency,
        "exchangeName": exchange,
        "regularMarketPrice": 179.38,
        "priceHint": 2,
    }
    return {"chart": {"result": [{"meta": meta, **fields}], "error": None}}


def test_current_prices_preserve_app_symbols_and_successful_quotes():
    with aioresponses() as http:
        http.get(chart_url("VWRA.L"), payload=chart("VWRA.L", exchange="LSE"))
        http.get(chart_url("INVALID"), status=404)
        http.get(chart_url("CHTR"), payload=chart("CHTR"))
        prices = async_to_sync(get_stocks_usa_prices)(["INVALID", "VWRA", "CHTR"])
    assert prices == {"VWRA": "179.38", "CHTR": "179.38"}


@pytest.mark.parametrize(
    "payload",
    [
        chart("VWRP.L", exchange="LSE"),
        chart("VWRA.L", currency="CHF", exchange="LSE"),
        chart("VWRA.L", exchange="SIX"),
    ],
)
def test_vwra_requires_the_london_usd_listing(payload):
    with aioresponses() as http:
        http.get(chart_url("VWRA.L"), payload=payload)
        assert async_to_sync(get_stocks_usa_prices)(["VWRA"]) == {}


@pytest.mark.parametrize(("day", "expected"), [(25, {"VWRA": Decimal("178.81")}), (28, {})])
def test_close_uses_requested_trading_date_and_unadjusted_close(day, expected):
    day_open = int(datetime(2026, 11, 25, 8, tzinfo=UTC).timestamp())
    result = chart(
        "VWRA.L",
        exchange="LSE",
        timestamp=[day_open, day_open + 86400],
        indicators={
            "quote": [{"close": [178.80999755859375, 179.38]}],
            "adjclose": [{"adjclose": [170, 171]}],
        },
    )
    result["chart"]["result"][0]["meta"]["exchangeTimezoneName"] = "Europe/London"
    with aioresponses() as http:
        http.get(chart_url("VWRA.L"), payload=result)
        assert async_to_sync(get_stocks_usa_close_prices)(["VWRA"], date(2026, 11, day)) == expected
