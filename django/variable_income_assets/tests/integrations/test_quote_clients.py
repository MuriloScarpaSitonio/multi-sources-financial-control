import asyncio

import pytest
from aioresponses import aioresponses
from asgiref.sync import async_to_sync

from ...integrations.clients import BrApiClient
from ...integrations.helpers import get_stocks_usa_prices


@pytest.mark.parametrize("last_status", [200, 429])
def test_brapi_honors_retry_after_and_continues_with_next_symbol(mocker, last_status):
    sleep = mocker.patch.object(asyncio, "sleep")
    query = "https://brapi.dev/api/available?search={}&token=test"
    quote = "https://brapi.dev/api/quote/AAA?token=test"

    async def fetch():
        async with BrApiClient(api_key="test") as client:
            return await client.get_b3_prices(["AAA", "BBB"])

    with aioresponses() as http:
        http.get(query.format("AAA"), payload={"stocks": ["AAA"]})
        for delay in ("2", "3"):
            http.get(quote, status=429, headers={"Retry-After": delay})
        http.get(quote, status=last_status, payload={"results": [{"regularMarketPrice": 42}]})
        http.get(query.format("BBB"), payload={"stocks": ["BBB"]})
        http.get(
            "https://brapi.dev/api/quote/BBB?token=test",
            payload={"results": [{"regularMarketPrice": 12}]},
        )
        prices = async_to_sync(fetch)()

    assert sleep.await_args_list == [mocker.call(2), mocker.call(3)]
    assert prices == ({"AAA": 42, "BBB": 12} if last_status == 200 else {"BBB": 12})


@pytest.mark.parametrize("currency", ["USD", "GBP"])
def test_vwra_uses_london_usd_listing_and_preserves_other_quotes(settings, currency):
    settings.TWELVE_DATA_API_KEY = "test"
    with aioresponses() as http:
        http.get(
            "https://query1.finance.yahoo.com/v8/finance/chart/VWRA.L",
            payload={
                "chart": {
                    "result": [
                        {
                            "meta": {
                                "symbol": "VWRA.L",
                                "exchangeName": "LSE",
                                "currency": currency,
                                "regularMarketPrice": 123.45,
                            }
                        }
                    ]
                }
            },
        )
        http.get("https://api.twelvedata.com/price?apikey=test&symbol=VT", payload={"price": "87"})
        prices = async_to_sync(get_stocks_usa_prices)(["VWRA", "VT"])
    expected = {"VT": "87"}
    if currency == "USD":
        expected["VWRA"] = "123.45"
    assert prices == expected
