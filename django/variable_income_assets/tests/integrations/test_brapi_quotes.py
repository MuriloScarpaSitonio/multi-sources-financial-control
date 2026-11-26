import asyncio
from collections import Counter
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from aioresponses import aioresponses
from asgiref.sync import async_to_sync

from ...choices import AssetTypes, Currencies
from ...integrations.clients import BrApiClient
from ...integrations.handlers import _fetch_prices


def test_refresh_serializes_quotes_across_brapi_groups(mocker):
    active = Counter()
    peak = Counter()
    codes = ["TUPY3", "RECR11", "MUND11"]
    types = [AssetTypes.stock, AssetTypes.fii, AssetTypes.equity_global]

    async def assets():
        for code, asset_type in zip(codes, types, strict=True):
            yield SimpleNamespace(code=code, type=asset_type, currency=Currencies.real)

    async def request(self, path, params=None):
        endpoint = path.split("/")[0]
        active[endpoint] += 1
        peak[endpoint] = max(peak[endpoint], active[endpoint])
        await asyncio.sleep(0)
        active[endpoint] -= 1
        if endpoint == "available":
            payload = {"stocks": [params["search"]]}
        else:
            payload = {"results": [{"regularMarketPrice": 42}]}
        return SimpleNamespace(json=AsyncMock(return_value=payload))

    mocker.patch.object(BrApiClient, "_request", request)
    mocker.patch("variable_income_assets.integrations.handlers.get_crypto_prices", return_value={})
    mocker.patch(
        "variable_income_assets.integrations.handlers.get_stocks_usa_prices", return_value={}
    )
    _, groups = async_to_sync(_fetch_prices)(assets())

    assert {code for group in groups for code in group["prices"]} == set(codes)
    assert peak["available"] > 1
    assert peak["quote"] == 1


@pytest.mark.parametrize(("status", "attempts"), [(429, 3), (404, 1)])
def test_quote_retries_only_throttling_then_continues(mocker, status, attempts):
    sleep = mocker.patch.object(asyncio, "sleep")
    url = "https://brapi.dev/api/quote/TUPY3?token=test"

    async def fetch():
        async with BrApiClient(api_key="test") as client:
            return await client.get_b3_prices(["TUPY3", "RECR11"])

    with aioresponses() as http:
        for code in ("TUPY3", "RECR11"):
            http.get(
                f"https://brapi.dev/api/available?search={code}&token=test",
                payload={"stocks": [code]},
            )
        http.get(url, status=status, headers={"Retry-After": "2"}, repeat=True)
        http.get(
            "https://brapi.dev/api/quote/RECR11?token=test",
            payload={"results": [{"regularMarketPrice": 42}]},
        )
        assert async_to_sync(fetch)() == {"RECR11": 42}
        assert (
            sum(len(calls) for (_, target), calls in http.requests.items() if str(target) == url)
            == attempts
        )
    assert sleep.await_args_list == [mocker.call(2)] * (attempts - 1)


def test_only_price_is_retried_after_429(mocker):
    sleep = mocker.patch.object(asyncio, "sleep")

    async def fetch():
        async with BrApiClient(api_key="test") as client:
            return await client.get_b3_prices(["TUPY3", "RECR11"])

    with aioresponses() as http:
        search = "https://brapi.dev/api/available?search=TUPY3&token=test"
        http.get(search, status=429)
        http.get(search, payload={"stocks": ["TUPY3"]})
        http.get(
            "https://brapi.dev/api/available?search=RECR11&token=test",
            payload={"stocks": ["RECR11"]},
        )
        quote = "https://brapi.dev/api/quote/RECR11?token=test"
        http.get(quote, status=429, headers={"Retry-After": "3"})
        http.get(quote, payload={"results": [{"regularMarketPrice": 42}]})
        assert async_to_sync(fetch)() == {"RECR11": 42}
        assert (
            sum(len(calls) for (_, url), calls in http.requests.items() if str(url) == search) == 1
        )
    sleep.assert_awaited_once_with(3)
