from decimal import Decimal
from typing import Union

import pytest

from authentication.tests.conftest import client, secrets, user

from .shared import (
    get_adjusted_avg_price_brute_forte,
    get_adjusted_quantity_brute_force,
    get_avg_price_bute_force,
    get_roi_brute_force,
)
from ..choices import TransactionActions
from ..models import Asset, Transaction

pytestmark = pytest.mark.django_db


@pytest.mark.usefixtures("transactions")
class TestModels:

    # Region: Tests DRY
    def _test_roi(self, asset: Asset, percentage: bool = False):
        # WHEN
        roi = get_roi_brute_force(asset=asset)
        initial_investment = sum(
            (
                transaction.price * transaction.quantity
                for transaction in asset.transactions.bought()
            )
        )
        expected = (roi / initial_investment) * 100 if percentage else roi

        # THEN
        assert round(asset.get_roi(percentage=percentage), 6) == round(expected, 6)

    def _test_asset_roi(
        self, asset: Asset, current_price: Union[int, Decimal] = 20, percentage: bool = False
    ):
        # GIVEN
        asset.current_price = current_price
        asset.save()

        self._test_roi(asset=asset, percentage=percentage)

    def _test_finished_asset_roi(
        self, asset: Asset, price: Union[int, Decimal], percentage: bool = False
    ):
        # GIVEN
        Transaction.objects.create(
            action=TransactionActions.sell,
            initial_price=asset.avg_price_from_transactions,
            price=price,
            asset=asset,
            quantity=asset.quantity_from_transactions,
        )

        self._test_roi(asset=asset, percentage=percentage)

    def _test_total_invested(self, asset: Asset):
        # GIVEN

        # WHEN
        quantity = get_adjusted_quantity_brute_force(asset=asset)
        avg_price = get_adjusted_avg_price_brute_forte(asset=asset)

        # THEN
        assert round(asset.total_adjusted_invested_from_transactions, 6) == round(
            avg_price * quantity, 6
        )

    # End region: Tests DRY

    # Region: Tests
    def test_should_calculate_avg_price(self, simple_asset):
        # GIVEN

        # WHEN
        expected = get_avg_price_bute_force(asset=simple_asset)

        # THEN
        assert round(simple_asset.avg_price_from_transactions, 6) == round(expected, 6)

    @pytest.mark.usefixtures("passive_incomes")
    def test_should_calculate_adjusted_avg_price(self, simple_asset):
        # GIVEN

        # WHEN
        expected = get_adjusted_avg_price_brute_forte(asset=simple_asset)

        # THEN
        assert round(simple_asset.adjusted_avg_price_from_transactions, 6) == round(expected, 6)

    def test_should_calculate_quantity(self, simple_asset):
        # GIVEN

        # WHEN
        expected = get_adjusted_quantity_brute_force(asset=simple_asset)

        # THEN
        assert simple_asset.quantity_from_transactions == expected

    @pytest.mark.usefixtures("passive_incomes")
    def test_should_calculate_adjusted_total_invested(self, simple_asset):
        self._test_total_invested(asset=simple_asset)

    def test_should_calculate_total_invested(self, simple_asset):
        self._test_total_invested(asset=simple_asset)

    def test_should_calculate_asset_roi(self, simple_asset):
        self._test_asset_roi(asset=simple_asset)

    @pytest.mark.usefixtures("passive_incomes")
    def test_should_calculate_asset_roi_w_passive_incomes(self, simple_asset):
        self._test_asset_roi(asset=simple_asset)

    @pytest.mark.usefixtures("passive_incomes")
    def test_should_calculate_asset_roi_w_non_distinct_passive_incomes(self, simple_asset):
        # GIVEN
        for income in simple_asset.incomes.all():
            income.amount = 250
            income.save()

        self._test_asset_roi(asset=simple_asset)

    def test_should_calculate_negative_asset_roi(self, simple_asset):
        self._test_asset_roi(asset=simple_asset, current_price=1)

    def test_should_calculate_finished_asset_roi(self, simple_asset):
        self._test_finished_asset_roi(asset=simple_asset, price=15)

    def test_should_calculate_finished_negative_asset_roi(self, simple_asset):
        self._test_finished_asset_roi(asset=simple_asset, price=1)

    def test_should_calculate_asset_roi_percentage(self, simple_asset):
        self._test_roi(asset=simple_asset, percentage=True)

    @pytest.mark.usefixtures("passive_incomes")
    def test_should_calculate_asset_roi_percentage_w_incomes(self, simple_asset):
        self._test_roi(asset=simple_asset, percentage=True)

    def test_should_calculate_negative_asset_roi_percentage(self, simple_asset):
        self._test_asset_roi(asset=simple_asset, percentage=True, current_price=1)

    @pytest.mark.usefixtures("passive_incomes")
    def test_should_calculate_negative_asset_roi_percentage_w_incomes(self, simple_asset):
        self._test_asset_roi(asset=simple_asset, percentage=True, current_price=1)

    def test_should_calculate_finished_asset_roi_percentage(self, simple_asset):
        self._test_finished_asset_roi(asset=simple_asset, price=15, percentage=True)

    def test_should_calculate_finished_negative_asset_roi_percentage(self, simple_asset):
        self._test_finished_asset_roi(asset=simple_asset, price=1, percentage=True)

    # End region: Tests
