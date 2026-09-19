from datetime import date
from decimal import Decimal

import pytest

from expenses.models import BankAccount

from ..models import AssetMetaData, AssetReadModel
from ..services.fire_allocation import classify_return_bucket

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    ("indexer", "maturity", "expected"),
    (
        ("CDI", None, ("FIXED_CDI", "CDI")),
        ("SELIC", None, ("FIXED_SELIC", "IMA_S")),
        ("PREFIXED", date(2027, 9, 17), ("FIXED_PREFIXED", "IRF_M_1")),
        ("PREFIXED", date(2027, 9, 18), ("FIXED_PREFIXED", "IRF_M_1_PLUS")),
        ("IPCA", date(2031, 9, 17), ("FIXED_IPCA", "IMA_B_5")),
        ("IPCA", date(2031, 9, 18), ("FIXED_IPCA", "IMA_B_5_PLUS")),
    ),
)
def test__classify_fixed_income(indexer, maturity, expected):
    assert (
        classify_return_bucket(
            asset_type="FIXED_BR",
            indexer=indexer,
            maturity_date=maturity,
            today=date(2026, 9, 17),
        )
        == expected
    )


@pytest.mark.freeze_time("2026-09-17 12:00:00")
def test__fire_allocation_returns_current_brl_totals_and_cash(client, user, another_user):
    stock_metadata = AssetMetaData.objects.create(
        code="BBAS3",
        type="STOCK",
        currency="BRL",
        current_price=Decimal("10"),
    )
    AssetReadModel.objects.create(
        write_model_pk=1,
        user_id=user.id,
        code="BBAS3",
        type="STOCK",
        currency="BRL",
        quantity_balance=Decimal("100"),
        metadata=stock_metadata,
    )
    fixed_metadata = AssetMetaData.objects.create(
        code="NTNB",
        type="FIXED_BR",
        currency="BRL",
        current_price=Decimal("20"),
    )
    AssetReadModel.objects.create(
        write_model_pk=2,
        user_id=user.id,
        code="NTNB",
        type="FIXED_BR",
        currency="BRL",
        quantity_balance=Decimal("100"),
        indexer="IPCA",
        maturity_date=date(2035, 1, 1),
        metadata=fixed_metadata,
    )
    BankAccount.objects.create(
        user=user,
        description="Conta corrente",
        amount=Decimal("500"),
        is_active=True,
    )

    AssetReadModel.objects.create(
        write_model_pk=3, user_id=another_user.id, code="BBAS3", type="STOCK",
        currency="BRL", quantity_balance=Decimal("900"), metadata=stock_metadata,
    )

    response = client.get("/api/v1/assets/fire_allocation")

    assert response.status_code == 200
    assert response.json() == {
        "as_of": "2026-09-17",
        "buckets": [
            {
                "category": "BR_EQUITY",
                "series": "IBOV",
                "total": 1000.0,
                "assets": [{"id": 1, "code": "BBAS3", "description": "", "total": 1000.0}],
            },
            {
                "category": "FIXED_IPCA",
                "series": "IMA_B_5_PLUS",
                "total": 2000.0,
                "assets": [{"id": 2, "code": "NTNB", "description": "", "total": 2000.0}],
            },
            {"category": "CASH", "series": "CASH", "total": 500.0, "assets": []},
        ],
    }
