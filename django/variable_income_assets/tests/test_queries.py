from decimal import Decimal
import pytest

from django.db.models import Q
from django.utils import timezone

from authentication.tests.conftest import client, secrets, user

from .shared import (
    convert_and_quantitize,
    get_avg_price_bute_force,
    get_total_credited_incomes_brute_force,
    get_total_invested_brute_force,
)
from ..choices import PassiveIncomeTypes, TransactionActions
from ..models import Asset, Transaction

pytestmark = pytest.mark.django_db


@pytest.mark.usefixtures("irpf_assets_data")
def test__asset__irp_infos(stock_usa_asset):
    # GIVEN
    year = timezone.now().year - 1

    # WHEN
    asset = (
        Asset.objects.order_by()
        .distinct()
        .annotate_irpf_infos(year=year)
        .values("avg_price", "total_invested")
        .get(pk=stock_usa_asset.pk)
    )

    # THEN
    assert convert_and_quantitize(
        get_avg_price_bute_force(
            asset=stock_usa_asset,
            normalize=False,
            extra_filters=Q(created_at__year__lte=year),
        )
    ) == convert_and_quantitize(asset["avg_price"])
    assert convert_and_quantitize(
        get_total_invested_brute_force(
            asset=stock_usa_asset,
            normalize=True,
            extra_filters=Q(created_at__year__lte=year),
        )
    ) == convert_and_quantitize(asset["total_invested"])


@pytest.mark.usefixtures("irpf_assets_data")
@pytest.mark.parametrize("incomes_type", list(PassiveIncomeTypes.values))
def test__asset__credited_incomes_at_given_year(stock_usa_asset, incomes_type):
    # GIVEN
    year = timezone.now().year - 1

    # WHEN
    asset = (
        Asset.objects.order_by()
        .distinct()
        .annotate_credited_incomes_at_given_year(year=year, incomes_type=incomes_type)
        .values("credited_incomes_total")
        .get(pk=stock_usa_asset.pk)
    )

    # THEN
    assert convert_and_quantitize(
        get_total_credited_incomes_brute_force(
            asset=stock_usa_asset, extra_filters=Q(type=incomes_type, operation_date__year=year)
        )
    ) == convert_and_quantitize(asset["credited_incomes_total"])


@pytest.mark.usefixtures("irpf_assets_data")
def test__asset__using_dollar_as(stock_usa_asset):
    # GIVEN
    year = timezone.now().year - 1

    # WHEN
    asset = (
        Asset.objects.order_by()
        .distinct()
        .using_dollar_as(Decimal(2))
        .annotate_irpf_infos(year=year)
        .values("avg_price", "total_invested")
        .get(pk=stock_usa_asset.pk)
    )
    asset2 = (
        Asset.objects.order_by()
        .distinct()
        .using_dollar_as(Decimal(4))
        .annotate_irpf_infos(year=year)
        .values("avg_price", "total_invested")
        .get(pk=stock_usa_asset.pk)
    )

    # THEN
    assert convert_and_quantitize(asset["avg_price"]) == convert_and_quantitize(asset2["avg_price"])
    assert convert_and_quantitize(asset["total_invested"] * 2) == convert_and_quantitize(
        asset2["total_invested"]
    )


@pytest.mark.usefixtures("irpf_transactions_data")
def test__transactions__using_dollar_as(stock_usa_asset):
    # GIVEN
    today = timezone.now().date()

    # WHEN
    normalized2 = {
        t.pk: t.roi
        for t in (
            Transaction.objects.using_dollar_as(Decimal(2))
            .filter(
                asset_id=stock_usa_asset.pk,
                created_at__year=today.year,
                created_at__month=today.month,
                action=TransactionActions.sell,
            )
            .annotate_raw_roi(normalize=True)
            .only("pk")
        )
    }
    normalized4 = {
        t.pk: t.roi
        for t in (
            Transaction.objects.using_dollar_as(Decimal(4))
            .filter(
                asset_id=stock_usa_asset.pk,
                created_at__year=today.year,
                created_at__month=today.month,
                action=TransactionActions.sell,
            )
            .annotate_raw_roi(normalize=True)
            .only("pk")
        )
    }

    unormalized2 = {
        t.pk: t.roi
        for t in (
            Transaction.objects.using_dollar_as(Decimal(2))
            .filter(
                asset_id=stock_usa_asset.pk,
                created_at__year=today.year,
                created_at__month=today.month,
                action=TransactionActions.sell,
            )
            .annotate_raw_roi(normalize=False)
            .only("pk")
        )
    }
    unormalized4 = {
        t.pk: t.roi
        for t in (
            Transaction.objects.using_dollar_as(Decimal(4))
            .filter(
                asset_id=stock_usa_asset.pk,
                created_at__year=today.year,
                created_at__month=today.month,
                action=TransactionActions.sell,
            )
            .annotate_raw_roi(normalize=False)
            .only("pk")
        )
    }

    # THEN
    for pk, roi in normalized2.items():
        assert convert_and_quantitize(roi * 2) == convert_and_quantitize(normalized4[pk])

    for pk, roi in unormalized2.items():
        assert roi == unormalized4[pk]
