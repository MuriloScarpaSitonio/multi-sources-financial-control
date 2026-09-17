from decimal import Decimal

import pytest

from .. import fire_returns as fire_returns_module
from ..fire_returns import (
    FIRE_RETURN_SERIES_KEYS,
    cash_real_returns,
    foreign_to_brl_returns,
    normalize_foreign_real_returns,
    render_fire_returns_ts,
    to_real_returns,
    validate_fire_return_series,
)


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
    complete = {
        key: {"2020-01": Decimal("0.01")} for key in FIRE_RETURN_SERIES_KEYS
    }

    validate_fire_return_series(complete)

    with pytest.raises(ValueError, match="Missing FIRE return series: CASH"):
        validate_fire_return_series(
            {key: value for key, value in complete.items() if key != "CASH"}
        )

    with pytest.raises(ValueError, match="FIRE return series CASH is empty"):
        validate_fire_return_series({**complete, "CASH": {}})
