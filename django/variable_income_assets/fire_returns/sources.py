from __future__ import annotations

import base64
import calendar
import csv
import io
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from decimal import Decimal
from itertools import pairwise

from .series import (
    MonthlySeries,
    cash_real_returns,
    foreign_to_brl_returns,
    to_real_returns,
)

B3_INDEX_URL = (
    "https://sistemaswebb3-listados.b3.com.br/"
    "indexStatisticsProxy/IndexCall/GetPortfolioDay"
)
BCB_SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series_id}/dados"
ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query"
COIN_METRICS_INDEXES_URL = "https://indexes.coinmetrics.io/api"
COIN_METRICS_ARCHIVE_URL = (
    "https://raw.githubusercontent.com/coinmetrics/data/master/csv/{asset}.csv"
)
PTAX_URL = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata"
ANBIMA_ARCHIVE_URL = "https://www.anbima.com.br/informacoes/ima/ima-sh-down.asp"

ETF_SYMBOLS = {
    "SPY": "SPY",
    "VTI": "VTI",
    "VT": "VT",
    # VWRD.LON is the USD trading line of the same distributing fund as
    # GBP-denominated VWRL.LON. Keeping the source in USD makes the shared
    # USD/BRL normalization correct while the product-facing proxy remains VWRL.
    "VWRL": "VWRD.LON",
}
BCB_SGS_RATE_SERIES_IDS = {
    "CDI": 4391,
    "IPCA": 433,
}
BCB_SGS_IMA_LEVEL_SERIES_IDS = {
    "IMA-S": 12462,
    "IRF-M 1": 17626,
    "IRF-M 1+": 17627,
    "IMA-B 5": 12467,
    "IMA-B 5+": 12468,
    "IMA-Geral ex-C": 17628,
}
_IMA_LEVEL_SERIES_IDS = frozenset(BCB_SGS_IMA_LEVEL_SERIES_IDS.values())
_TRANSIENT_HTTP_CODES = frozenset((429, 500, 502, 503, 504))


def _fetch_bytes(request: urllib.request.Request) -> bytes:
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            if exc.code not in _TRANSIENT_HTTP_CODES or attempt == 2:
                raise
            time.sleep(2**attempt)
    raise RuntimeError("unreachable")


def fetch_json(url: str, params: dict[str, str | int] | None = None) -> dict | list:
    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    request = urllib.request.Request(
        f"{url}{query}",
        headers={"User-Agent": "multi-sources-financial-control/1.0"},
    )
    return json.loads(_fetch_bytes(request).decode("utf-8"))


def fetch_text(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "multi-sources-financial-control/1.0"},
    )
    return _fetch_bytes(request).decode("utf-8")


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
    return close_levels_to_returns(
        {month: value for month, (_, value) in month_end.items()}
    )


def _parse_b3_number(value: str) -> Decimal:
    return Decimal(value.replace(",", ""))


def fetch_b3_index_monthly(index: str, start_year: int, end_year: int) -> MonthlySeries:
    month_end: dict[str, tuple[date, Decimal]] = {}
    for year in range(start_year - 1, end_year + 1):
        payload = json.dumps(
            {"language": "en-us", "index": index, "year": year},
            separators=(",", ":"),
        ).encode()
        url = f"{B3_INDEX_URL}/{base64.b64encode(payload).decode()}"
        response = fetch_json(url)
        for row in response.get("results") or []:
            day = int(row["day"])
            for month_number in range(1, 13):
                raw_value = row.get(f"rateValue{month_number}")
                if raw_value is None:
                    continue
                try:
                    refdate = date(year, month_number, day)
                except ValueError:
                    continue
                value = _parse_b3_number(raw_value)
                if index == "IBOV" and refdate < date(1997, 3, 3):
                    value /= Decimal(10)
                month = refdate.strftime("%Y-%m")
                if month not in month_end or refdate > month_end[month][0]:
                    month_end[month] = (refdate, value)

    result = close_levels_to_returns(
        {month: value for month, (_, value) in month_end.items()}
    )
    return {
        month: value
        for month, value in result.items()
        if start_year <= int(month[:4]) <= end_year
    }


def _decimal_from_brazilian(value: str) -> Decimal:
    return Decimal(value.replace(".", "").replace(",", "."))


def fetch_bcb_sgs_monthly(
    series_id: int, start_year: int, end_year: int
) -> MonthlySeries:
    is_level_series = series_id in _IMA_LEVEL_SERIES_IDS
    query_start_year = start_year - is_level_series
    ranges = (
        [
            (chunk_start, min(chunk_start + 9, end_year))
            for chunk_start in range(query_start_year, end_year + 1, 10)
        ]
        if is_level_series
        else [(query_start_year, end_year)]
    )
    rows = []
    for chunk_start, chunk_end in ranges:
        try:
            chunk_rows = fetch_json(
                BCB_SGS_URL.format(series_id=series_id),
                params={
                    "formato": "json",
                    "dataInicial": f"01/01/{chunk_start}",
                    "dataFinal": f"31/12/{chunk_end}",
                },
            )
        except urllib.error.HTTPError as exc:
            if is_level_series and exc.code == 404:
                continue
            raise
        rows.extend(chunk_rows)
    if not is_level_series:
        return {
            datetime.strptime(row["data"], "%d/%m/%Y").strftime("%Y-%m"): (
                Decimal(row["valor"].replace(",", ".")) / Decimal(100)
            )
            for row in rows
            if start_year
            <= datetime.strptime(row["data"], "%d/%m/%Y").year
            <= end_year
        }

    month_end: dict[str, tuple[date, Decimal]] = {}
    for row in rows:
        refdate = datetime.strptime(row["data"], "%d/%m/%Y").date()
        month = refdate.strftime("%Y-%m")
        if month not in month_end or refdate > month_end[month][0]:
            month_end[month] = (
                refdate,
                Decimal(row["valor"].replace(",", ".")),
            )
    result = close_levels_to_returns(
        {month: value for month, (_, value) in month_end.items()}
    )
    return {
        month: value
        for month, value in result.items()
        if start_year <= int(month[:4]) <= end_year
    }


def fetch_alpha_vantage_adjusted_monthly(symbol: str, api_key: str) -> MonthlySeries:
    payload = None
    for attempt in range(3):
        payload = fetch_json(
            ALPHA_VANTAGE_URL,
            params={
                "function": "TIME_SERIES_MONTHLY_ADJUSTED",
                "symbol": symbol,
                "apikey": api_key,
                "outputsize": "full",
            },
        )
        if isinstance(payload, dict) and "Monthly Adjusted Time Series" in payload:
            break
        information = payload.get("Information", "") if isinstance(payload, dict) else ""
        if "1 request per second" not in information or attempt == 2:
            break
        time.sleep(1.1)
    if "Monthly Adjusted Time Series" not in payload:
        raise RuntimeError(f"Alpha Vantage did not return monthly data for {symbol}: {payload}")
    closes = {
        month[:7]: Decimal(row["5. adjusted close"])
        for month, row in payload["Monthly Adjusted Time Series"].items()
    }
    return close_levels_to_returns(closes)


def fetch_coin_metrics_asset_monthly(
    asset: str, start_year: int, end_year: int
) -> MonthlySeries:
    payload = fetch_text(COIN_METRICS_ARCHIVE_URL.format(asset=asset))
    rows = [
        row
        for row in csv.DictReader(io.StringIO(payload))
        if row.get("PriceUSD")
        and start_year - 1 <= int(row["time"][:4]) <= end_year
    ]
    result = daily_levels_to_monthly_returns(
        rows,
        value_field="PriceUSD",
    )
    return {
        month: value
        for month, value in result.items()
        if start_year <= int(month[:4]) <= end_year
    }


def fetch_coin_metrics_index_monthly(
    index: str, start_year: int, end_year: int
) -> MonthlySeries:
    payload = fetch_json(
        f"{COIN_METRICS_INDEXES_URL}/historical-data",
        params={
            "index": index,
            "start_time": f"{start_year - 1}-12-01",
            "end_time": f"{end_year}-12-31",
            "timezone": "America/New_York",
        },
    )
    result = daily_levels_to_monthly_returns(
        [
            {"time": row["iso_date"], "close": row["close"]}
            for row in payload["daily"]
        ],
        value_field="close",
    )
    return {
        month: value
        for month, value in result.items()
        if start_year <= int(month[:4]) <= end_year
    }


def fetch_ptax_month_end_selling(
    start_year: int, end_year: int
) -> dict[str, Decimal]:
    month_end: dict[str, tuple[str, Decimal]] = {}
    endpoint = (
        f"{PTAX_URL}/CotacaoDolarPeriodo(dataInicial=@dataInicial,"
        "dataFinalCotacao=@dataFinalCotacao)"
    )
    for year in range(start_year - 1, end_year + 1):
        payload = fetch_json(
            endpoint,
            params={
                "@dataInicial": f"'01-01-{year}'",
                "@dataFinalCotacao": f"'12-31-{year}'",
                "$format": "json",
                "$select": "cotacaoVenda,dataHoraCotacao",
            },
        )
        for row in payload["value"]:
            day = row["dataHoraCotacao"][:10]
            month = day[:7]
            if month not in month_end or day > month_end[month][0]:
                month_end[month] = (day, Decimal(str(row["cotacaoVenda"])))
    return {month: value for month, (_, value) in month_end.items()}


def parse_anbima_ima_snapshot(payload: bytes) -> dict[str, Decimal]:
    result = {}
    for line in payload.decode("latin-1").splitlines():
        columns = line.split("@")
        if len(columns) < 4 or columns[0] != "1" or columns[1] in (
            "Índice",
            "TOTAIS",
        ):
            continue
        if "/" in columns[1]:
            index_name, value = columns[2], columns[3]
        else:
            index_name, value = columns[1], columns[3]
        try:
            result[index_name] = _decimal_from_brazilian(value)
        except Exception:
            continue
    return result


def _fetch_anbima_snapshot(refdate: date) -> dict[str, Decimal]:
    form = urllib.parse.urlencode(
        {
            "escolha": "2",
            "Idioma": "PT",
            "saida": "txt",
            "Dt_Ref": refdate.strftime("%d/%m/%Y"),
            "Dt_Ref_Ver": refdate.strftime("%Y%m%d"),
            "Pai": "ima",
            "Tipo": "",
            "DataRef": "",
        }
    ).encode()
    request = urllib.request.Request(
        ANBIMA_ARCHIVE_URL,
        data=form,
        headers={"User-Agent": "multi-sources-financial-control/1.0"},
    )
    return parse_anbima_ima_snapshot(_fetch_bytes(request))


def _normalized_index_name(value: str) -> str:
    return "".join(char for char in value.upper() if char.isalnum())


def fetch_anbima_ima_monthly(
    index: str, start_year: int, end_year: int
) -> MonthlySeries:
    first_month = (
        date(2023, 5, 1)
        if start_year <= 2023
        else date(start_year - 1, 12, 1)
    )
    last_month = date(end_year, 12, 1)
    if first_month > last_month:
        return {}

    levels: dict[str, Decimal] = {}
    month = first_month
    target_name = _normalized_index_name(index)
    while month <= last_month:
        last_day = calendar.monthrange(month.year, month.month)[1]
        candidate = date(month.year, month.month, last_day)
        for offset in range(8):
            snapshot = _fetch_anbima_snapshot(candidate - timedelta(days=offset))
            matched = next(
                (
                    value
                    for name, value in snapshot.items()
                    if _normalized_index_name(name) == target_name
                ),
                None,
            )
            if matched is not None:
                levels[month.strftime("%Y-%m")] = matched
                break
        month = (
            date(month.year + 1, 1, 1)
            if month.month == 12
            else date(month.year, month.month + 1, 1)
        )

    returns = close_levels_to_returns(levels)
    return {
        month: value
        for month, value in returns.items()
        if start_year <= int(month[:4]) <= end_year
    }


def fetch_ima_monthly(index: str, start_year: int, end_year: int) -> MonthlySeries:
    series_id = BCB_SGS_IMA_LEVEL_SERIES_IDS.get(index)
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


def build_fire_return_series(
    *, start_year: int, end_year: int, alpha_vantage_api_key: str
) -> dict[str, MonthlySeries]:
    ipca = fetch_bcb_sgs_monthly(
        BCB_SGS_RATE_SERIES_IDS["IPCA"], start_year, end_year
    )
    usd_brl = close_levels_to_returns(
        fetch_ptax_month_end_selling(start_year, end_year)
    )
    brl_nominal = {
        "IBOV": fetch_b3_index_monthly("IBOV", start_year, end_year),
        "IFIX": fetch_b3_index_monthly("IFIX", start_year, end_year),
        "CDI": fetch_bcb_sgs_monthly(
            BCB_SGS_RATE_SERIES_IDS["CDI"], start_year, end_year
        ),
        "IMA_S": fetch_ima_monthly("IMA-S", start_year, end_year),
        "IRF_M_1": fetch_ima_monthly("IRF-M 1", start_year, end_year),
        "IRF_M_1_PLUS": fetch_ima_monthly("IRF-M 1+", start_year, end_year),
        "IMA_B_5": fetch_ima_monthly("IMA-B 5", start_year, end_year),
        "IMA_B_5_PLUS": fetch_ima_monthly("IMA-B 5+", start_year, end_year),
        "IMA_GERAL_EX_C": fetch_ima_monthly("IMA-Geral ex-C", start_year, end_year),
    }
    foreign_nominal = {
        key: fetch_alpha_vantage_adjusted_monthly(symbol, alpha_vantage_api_key)
        for key, symbol in ETF_SYMBOLS.items()
    }
    foreign_nominal["BTC"] = fetch_coin_metrics_asset_monthly(
        "btc", start_year, end_year
    )
    foreign_nominal["CMBI10"] = fetch_coin_metrics_index_monthly(
        "CMBI10", start_year, end_year
    )

    result = {
        key: to_real_returns(values, ipca) for key, values in brl_nominal.items()
    }
    result.update(
        {
            key: to_real_returns(foreign_to_brl_returns(values, usd_brl), ipca)
            for key, values in foreign_nominal.items()
        }
    )
    result["CASH"] = cash_real_returns(ipca)
    return result
