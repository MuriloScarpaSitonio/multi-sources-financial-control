from datetime import datetime, timedelta

from django.db.models import Q
from django.utils import timezone

import pytest

from ...choices import PassiveIncomeEventTypes, PassiveIncomeTypes, TransactionActions
from ...models import AssetClosedOperation, Transaction
from ...service_layer.tasks import create_asset_closed_operation
from ...service_layer.tasks.exceptions import AssetOpenedException
from ..conftest import PassiveIncomeFactory, TransactionFactory
from ..shared import (
    get_quantity_bought_brute_force,
    get_total_bought_brute_force,
    get_total_credited_incomes_brute_force,
    get_total_sold_brute_force,
)

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    ("fixture", "asset_fixture", "current_currency_conversion_rate"),
    (
        # ("loss_asset_previously_closed_w_profit_loss", "stock_asset", 1),
        ("loss_asset_usa_previously_closed_w_profit_loss", "stock_usa_asset", 6.3),
    ),
)
def test__previously_closed(request, fixture, asset_fixture, current_currency_conversion_rate):
    # GIVEN
    request.getfixturevalue(fixture)
    asset = request.getfixturevalue(asset_fixture)
    kwargs = {
        "type": PassiveIncomeTypes.dividend,
        "amount": 120,
        "asset": asset,
        "current_currency_conversion_rate": current_currency_conversion_rate,
    }
    operation_date = timezone.localdate(AssetClosedOperation.objects.first().operation_datetime)
    PassiveIncomeFactory(  # disregard old incomes
        operation_date=operation_date - timedelta(days=2),
        event_type=PassiveIncomeEventTypes.credited,
        **kwargs,
    )
    PassiveIncomeFactory(  # disregard provisioned
        operation_date=operation_date + timedelta(days=2),
        event_type=PassiveIncomeEventTypes.provisioned,
        **kwargs,
    )
    PassiveIncomeFactory(  # keep
        operation_date=operation_date + timedelta(days=2),
        event_type=PassiveIncomeEventTypes.credited,
        **kwargs,
    )
    extra_filters = Q(operation_date__gt=operation_date)
    transaction = TransactionFactory(
        action=TransactionActions.sell,
        price=150,
        asset=asset,
        quantity=500,
        operation_date=timezone.localdate(),
        current_currency_conversion_rate=current_currency_conversion_rate,
    )

    # WHEN
    create_asset_closed_operation(asset_pk=asset.pk)

    # THEN
    assert AssetClosedOperation.objects.count() == 2
    assert (
        AssetClosedOperation.objects.filter(
            asset=asset,
            operation_datetime=timezone.make_aware(
                datetime.combine(transaction.operation_date, datetime.min.time())
            ),
            normalized_credited_incomes=get_total_credited_incomes_brute_force(
                asset, extra_filters=extra_filters
            ),
            credited_incomes=get_total_credited_incomes_brute_force(
                asset, normalize=False, extra_filters=extra_filters
            ),
            normalized_total_sold=get_total_sold_brute_force(asset, extra_filters=extra_filters),
            normalized_total_bought=get_total_bought_brute_force(
                asset, extra_filters=extra_filters
            ),
            quantity_bought=get_quantity_bought_brute_force(asset, extra_filters=extra_filters),
            total_bought=get_total_bought_brute_force(
                asset, extra_filters=extra_filters, normalize=False
            ),
        ).count()
        == 1
    )


@pytest.mark.usefixtures("another_stock_asset_transactions")
def test__closed(another_stock_asset):
    # GIVEN
    last_operation_date = (
        Transaction.objects.filter(asset=another_stock_asset)
        .order_by("-operation_date")
        .values_list("operation_date", flat=True)
        .first()
    )

    # WHEN
    create_asset_closed_operation(asset_pk=another_stock_asset.pk)

    # THEN
    assert AssetClosedOperation.objects.count() == 1
    assert (
        AssetClosedOperation.objects.filter(
            asset=another_stock_asset,
            operation_datetime=timezone.make_aware(
                datetime.combine(last_operation_date, datetime.min.time())
            ),
            credited_incomes=get_total_credited_incomes_brute_force(
                another_stock_asset, normalize=False
            ),
            normalized_credited_incomes=get_total_credited_incomes_brute_force(another_stock_asset),
            normalized_total_sold=get_total_sold_brute_force(another_stock_asset),
            normalized_total_bought=get_total_bought_brute_force(another_stock_asset),
            total_bought=get_total_bought_brute_force(another_stock_asset, normalize=False),
            quantity_bought=get_quantity_bought_brute_force(another_stock_asset),
        ).count()
        == 1
    )


@pytest.mark.usefixtures("crypto_brl_transaction")
def test__opened(crypto_asset_brl):
    # GIVEN

    # WHEN
    with pytest.raises(AssetOpenedException) as e:
        create_asset_closed_operation(asset_pk=crypto_asset_brl.pk)

    # THEN
    assert str(e.value) == (
        f"Esse ativo (pk={crypto_asset_brl.pk}) ainda tem um saldo positivo de transações. "
        "Essa operação deve ser realizada apenas em ativos com um balanço de transações zerado"
    )
