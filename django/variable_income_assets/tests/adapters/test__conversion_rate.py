from decimal import Decimal
from unittest.mock import patch

import pytest

from config.key_value_store import MemoryBackend
from variable_income_assets.adapters.key_value_store import (
    get_dollar_conversion_rate,
    update_dollar_conversion_rate,
)
from variable_income_assets.choices import Currencies
from variable_income_assets.models.write import ConversionRate

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clean_state():
    """Clear cache and DB between tests."""
    MemoryBackend._storage.clear()
    ConversionRate.objects.all().delete()


class TestGetDollarConversionRate:
    def test__returns_cached_value_when_cache_hit(self, settings):
        # GIVEN
        cached_value = Decimal("5.50")
        with patch(
            "variable_income_assets.adapters.key_value_store.key_value_backend"
        ) as mock_backend:
            mock_backend.get.return_value = cached_value

            # WHEN
            result = get_dollar_conversion_rate()

        # THEN
        assert result == cached_value
        mock_backend.get.assert_called_once_with(key=settings.DOLLAR_CONVERSION_RATE_KEY)

    def test__queries_db_and_caches_on_cache_miss(self, settings):
        # GIVEN
        db_value = Decimal("5.75")
        ConversionRate.objects.create(
            from_currency=Currencies.dollar,
            to_currency=Currencies.real,
            value=db_value,
        )
        mock_backend = MemoryBackend()

        with patch(
            "variable_income_assets.adapters.key_value_store.key_value_backend", mock_backend
        ):
            # WHEN
            result = get_dollar_conversion_rate()

        # THEN
        assert result == db_value
        assert mock_backend.get(settings.DOLLAR_CONVERSION_RATE_KEY) == db_value

    def test__returns_default_when_no_db_row_and_cache_miss(self, settings):
        # GIVEN
        mock_backend = MemoryBackend()

        with patch(
            "variable_income_assets.adapters.key_value_store.key_value_backend", mock_backend
        ):
            # WHEN
            result = get_dollar_conversion_rate()

        # THEN
        assert result == settings.DEFAULT_DOLLAR_CONVERSION_RATE
        assert mock_backend.get(settings.DOLLAR_CONVERSION_RATE_KEY) is None


class TestUpdateDollarConversionRate:
    def test__creates_db_row_and_updates_cache_with_provided_value(self, settings):
        # GIVEN
        new_value = Decimal("6.00")
        mock_backend = MemoryBackend()

        with patch(
            "variable_income_assets.adapters.key_value_store.key_value_backend", mock_backend
        ):
            # WHEN
            result = update_dollar_conversion_rate(value=new_value)

        # THEN
        assert result == new_value
        rate = ConversionRate.objects.get(
            from_currency=Currencies.dollar, to_currency=Currencies.real
        )
        assert rate.value == new_value
        assert mock_backend.get(settings.DOLLAR_CONVERSION_RATE_KEY) == new_value

    def test__updates_existing_db_row(self, settings):
        # GIVEN
        old_value = Decimal("5.00")
        new_value = Decimal("6.50")
        ConversionRate.objects.create(
            from_currency=Currencies.dollar,
            to_currency=Currencies.real,
            value=old_value,
        )
        mock_backend = MemoryBackend()

        with patch(
            "variable_income_assets.adapters.key_value_store.key_value_backend", mock_backend
        ):
            # WHEN
            result = update_dollar_conversion_rate(value=new_value)

        # THEN
        assert result == new_value
        assert ConversionRate.objects.count() == 1
        rate = ConversionRate.objects.get(
            from_currency=Currencies.dollar, to_currency=Currencies.real
        )
        assert rate.value == new_value

    def test__fetches_from_api_when_value_not_provided(self, settings):
        # GIVEN
        api_value = Decimal("5.89")
        mock_backend = MemoryBackend()

        with (
            patch(
                "variable_income_assets.adapters.key_value_store.key_value_backend", mock_backend
            ),
            patch(
                "variable_income_assets.integrations.helpers.fetch_dollar_to_real_conversion_value",
                return_value=api_value,
            ),
        ):
            # WHEN
            result = update_dollar_conversion_rate()

        # THEN
        assert result == api_value
        rate = ConversionRate.objects.get(
            from_currency=Currencies.dollar, to_currency=Currencies.real
        )
        assert rate.value == api_value

    def test__uses_default_when_api_fails(self, settings):
        # GIVEN
        mock_backend = MemoryBackend()

        with (
            patch(
                "variable_income_assets.adapters.key_value_store.key_value_backend", mock_backend
            ),
            patch(
                "variable_income_assets.integrations.helpers.fetch_dollar_to_real_conversion_value",
                side_effect=Exception("API error"),
            ),
        ):
            # WHEN
            result = update_dollar_conversion_rate()

        # THEN
        # Compare rounded values due to float->Decimal precision issues in settings
        assert round(result, 2) == round(settings.DEFAULT_DOLLAR_CONVERSION_RATE, 2)
        rate = ConversionRate.objects.get(
            from_currency=Currencies.dollar, to_currency=Currencies.real
        )
        assert round(rate.value, 2) == round(settings.DEFAULT_DOLLAR_CONVERSION_RATE, 2)
