from datetime import date
from decimal import Decimal

import pytest

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
from variable_income_assets.models import AssetReadModel, PassiveIncome, Transaction
from variable_income_assets.service_layer.tasks import upsert_asset_read_model
from variable_income_assets.tests.conftest import (
    AssetFactory,
    AssetMetaDataFactory,
    TransactionFactory,
)

pytestmark = pytest.mark.django_db


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
