import base64
import json
from datetime import date

import pytest

from variable_income_assets import scripts


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def _monthly_bcb_rows(start_year: int, end_year: int, monthly_value: float) -> list[dict[str, str]]:
    return [
        {"data": f"01/{month:02d}/{year}", "valor": f"{monthly_value:.2f}"}
        for year in range(start_year, end_year + 1)
        for month in range(1, 13)
    ]


def _b3_rows(index: str, year: int) -> list[dict[str, str]]:
    split_date = date(1997, 3, 3)
    ibov_closes = {
        1994: 1_000,
        1995: 1_200,
        1996: 2_000,
        1997: 3_000,
    }

    def normalized_close() -> float:
        if index == "IFIX":
            return {2010: 1_000, 2011: 1_100}.get(year, 1_100)
        return ibov_closes.get(year, 3_000 + (year - 1997) * 100)

    rows = []
    for day in range(1, 22):
        row = {"day": str(day)}
        for month in range(1, 13):
            refdate = date(year, month, day)
            value = normalized_close()
            if index == "IBOV" and refdate < split_date:
                value *= 10
            row[f"rateValue{month}"] = f"{value:.2f}"
        rows.append(row)
    return rows


def test_generate_fire_returns_ts_emits_b3_and_bcb_real_returns(tmp_path, monkeypatch):
    def fake_urlopen(request, timeout):
        assert timeout == 30
        url = request.full_url
        assert request.headers["User-agent"] == "multi-sources-financial-control/1.0"

        if "GetPortfolioDay/" in url:
            encoded = url.split("GetPortfolioDay/", 1)[1]
            payload = json.loads(base64.b64decode(encoded))
            return FakeResponse({"results": _b3_rows(payload["index"], payload["year"])})

        if "bcdata.sgs.4391" in url:
            return FakeResponse(_monthly_bcb_rows(1995, 2011, 1.0))

        if "bcdata.sgs.433" in url:
            return FakeResponse(_monthly_bcb_rows(1995, 2011, 0.0))

        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(scripts.urllib.request, "urlopen", fake_urlopen)

    output = tmp_path / "fireReturns.ts"
    scripts.generate_fire_returns_ts(
        output_path=str(output),
        start_year=1995,
        end_year=2011,
    )

    content = output.read_text()
    assert "export const FIRE_RETURNS_YEARS: readonly number[] = [1995, 1996, 1997" in content
    assert "export const IFIX_YEARS: readonly number[] = [2011];" in content
    assert "0.500000" in content  # 1997 IBOV split boundary: 3000 / (20000 / 10) - 1
    assert "0.126825" in content  # CDI: 12 months of 1% compounded
    assert "export const IFIX_REAL_RETURNS: readonly number[] = [0.100000];" in content


def test_generate_fire_returns_ts_rejects_pre_1995_start_year():
    with pytest.raises(ValueError, match="start_year >= 1995"):
        scripts.generate_fire_returns_ts(output_path=None, start_year=1994, end_year=1995)
