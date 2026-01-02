from decimal import Decimal

from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED, HTTP_400_BAD_REQUEST

from authentication.models import CustomUser
from authentication.tests.conftest import UserFactory
from config.settings.base import BASE_API_URL

from ...choices import AssetObjectives, AssetTypes, Currencies, LiquidityTypes
from ...models import Asset, AssetReadModel
from ..conftest import (
    AssetFactory,
    AssetMetaDataFactory,
    AssetReadModelFactory,
    SyncAssetReadModelCommand,
)

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets"


class TestCreateFixedBRAssetLiquidityValidation:
    """Test that FIXED_BR assets require liquidity_type on creation."""

    def test__create_fixed_br__requires_liquidity_type(self, client):
        # GIVEN - FIXED_BR asset without liquidity_type
        data = {
            "type": AssetTypes.fixed_br,
            "objective": AssetObjectives.dividend,
            "currency": Currencies.real,
            "description": "CDB Banco X",
            "code": "CDB-BANCO-X",
            "is_held_in_self_custody": False,
        }

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_400_BAD_REQUEST
        assert response.json() == {
            "liquidity_type": ["Este campo é obrigatório para ativos de renda fixa."]
        }

    def test__create_fixed_br__with_liquidity_type_daily(self, client, user):
        # GIVEN - FIXED_BR asset with liquidity_type
        data = {
            "type": AssetTypes.fixed_br,
            "objective": AssetObjectives.dividend,
            "currency": Currencies.real,
            "description": "CDB Banco X",
            "code": "CDB-BANCO-X",
            "is_held_in_self_custody": False,
            "liquidity_type": LiquidityTypes.daily,
        }

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_201_CREATED

        # Assert DB has the field
        assert Asset.objects.filter(
            user=user, liquidity_type=LiquidityTypes.daily, maturity_date__isnull=True
        ).exists()

    def test__create_fixed_br__with_liquidity_type_at_maturity_and_date(self, client, user):
        # GIVEN
        future_date = timezone.localdate() + relativedelta(months=6)
        data = {
            "type": AssetTypes.fixed_br,
            "objective": AssetObjectives.dividend,
            "currency": Currencies.real,
            "description": "LCI Banco Y",
            "code": "LCI-BANCO-Y",
            "is_held_in_self_custody": False,
            "liquidity_type": LiquidityTypes.at_maturity,
            "maturity_date": future_date.strftime("%d/%m/%Y"),
        }

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_201_CREATED

        assert Asset.objects.filter(
            user=user, liquidity_type=LiquidityTypes.at_maturity, maturity_date=future_date
        ).exists()


class TestNonFixedBRAssetIgnoresLiquidityFields:
    """Test that non-FIXED_BR assets ignore liquidity fields."""

    def test__create_stock__ignores_liquidity_type(self, client, user, mocker):
        # GIVEN
        code = "PETR4"
        mocker.patch(
            "variable_income_assets.integrations.helpers.get_b3_prices",
            return_value={code: Decimal("30.00")},
        )
        data = {
            "type": AssetTypes.stock,
            "objective": AssetObjectives.dividend,
            "currency": Currencies.real,
            "code": code,
            "liquidity_type": LiquidityTypes.daily,  # Should be ignored
        }

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_201_CREATED

        asset = Asset.objects.get(user=user, code=code)
        assert asset.liquidity_type == ""  # Cleared for non-FIXED_BR


class TestEditFixedBRAssetWithEmptyLiquidity:
    """Test that editing FIXED_BR with empty liquidity forces setting it."""

    @pytest.fixture
    def fixed_br_asset_with_empty_liquidity(self, user):
        """Create a FIXED_BR asset with empty liquidity_type (simulating existing data)."""
        return AssetFactory(
            code="old-cdb",
            description="Old CDB",
            type=AssetTypes.fixed_br,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type="",
            maturity_date=None,
            user=user,
        )

    def test__update_fixed_br__requires_liquidity_if_empty(
        self, client, fixed_br_asset_with_empty_liquidity
    ):
        # GIVEN - Existing FIXED_BR with empty liquidity
        asset = fixed_br_asset_with_empty_liquidity
        data = {
            "type": asset.type,
            "objective": asset.objective,
            "currency": asset.currency,
            "description": "Updated CDB",
            "code": asset.code,
            # No liquidity_type provided
        }

        # WHEN
        response = client.put(f"{URL}/{asset.pk}", data=data)

        # THEN
        assert response.status_code == HTTP_400_BAD_REQUEST
        assert response.json() == {
            "liquidity_type": ["Este campo é obrigatório para ativos de renda fixa."]
        }

    def test__update_fixed_br__with_liquidity_succeeds(
        self, client, fixed_br_asset_with_empty_liquidity
    ):
        # GIVEN
        asset = fixed_br_asset_with_empty_liquidity
        data = {
            "type": asset.type,
            "objective": asset.objective,
            "currency": asset.currency,
            "description": "Updated CDB",
            "code": asset.code,
            "liquidity_type": LiquidityTypes.daily,
        }

        # WHEN
        response = client.put(f"{URL}/{asset.pk}", data=data)

        # THEN
        assert response.status_code == HTTP_200_OK

        asset.refresh_from_db()
        assert asset.liquidity_type == LiquidityTypes.daily


class TestMaturityDateValidation:
    """Test maturity_date must be in the future on creation."""

    def test__create_fixed_br__maturity_date_in_past_fails(self, client):
        # GIVEN
        past_date = timezone.localdate() - relativedelta(months=1)
        data = {
            "type": AssetTypes.fixed_br,
            "objective": AssetObjectives.dividend,
            "currency": Currencies.real,
            "description": "CDB Vencido",
            "code": "CDB-VENCIDO",
            "is_held_in_self_custody": False,
            "liquidity_type": LiquidityTypes.at_maturity,
            "maturity_date": past_date.strftime("%d/%m/%Y"),
        }

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_400_BAD_REQUEST
        assert response.json() == {"maturity_date": ["A data de vencimento deve ser no futuro."]}

    def test__create_fixed_br__maturity_date_in_future_succeeds(self, client, user):
        # GIVEN
        future_date = timezone.localdate() + relativedelta(months=12)
        data = {
            "type": AssetTypes.fixed_br,
            "objective": AssetObjectives.dividend,
            "currency": Currencies.real,
            "description": "CDB Futuro",
            "code": "CDB-FUTURO",
            "is_held_in_self_custody": False,
            "liquidity_type": LiquidityTypes.at_maturity,
            "maturity_date": future_date.strftime("%d/%m/%Y"),
        }

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_201_CREATED

        assert Asset.objects.filter(user=user, maturity_date=future_date).exists()


class TestEmergencyFundFilter:
    """Test the emergency_fund filter on /assets endpoint."""

    @pytest.fixture
    def mixed_assets_for_emergency_fund(self, user):
        """Create a mix of assets for testing emergency fund filter.

        We create AssetReadModel directly since the filter operates on read models.
        """
        # FIXED_BR with DAILY liquidity (should be included)
        daily_fixed = AssetReadModelFactory(
            write_model_pk=1,
            user_id=user.pk,
            code="cdb-daily",
            type=AssetTypes.fixed_br,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type=LiquidityTypes.daily,
            maturity_date=None,
            quantity_balance=Decimal("100.00"),
        )

        # FIXED_BR with AT_MATURITY and future date (should NOT be included)
        future_maturity = AssetReadModelFactory(
            write_model_pk=2,
            user_id=user.pk,
            code="lci-future",
            type=AssetTypes.fixed_br,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type=LiquidityTypes.at_maturity,
            maturity_date=timezone.localdate() + relativedelta(years=1),
            quantity_balance=Decimal("100.00"),
        )

        # FIXED_BR with empty liquidity (should NOT be included)
        empty_liquidity = AssetReadModelFactory(
            write_model_pk=3,
            user_id=user.pk,
            code="cdb-empty",
            type=AssetTypes.fixed_br,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type="",
            maturity_date=None,
            quantity_balance=Decimal("100.00"),
        )

        # STOCK asset (should NOT be included)
        stock = AssetReadModelFactory(
            write_model_pk=4,
            user_id=user.pk,
            code="PETR4",
            type=AssetTypes.stock,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type="",
            quantity_balance=Decimal("100.00"),
        )

        return {
            "daily_fixed": daily_fixed,
            "future_maturity": future_maturity,
            "empty_liquidity": empty_liquidity,
            "stock": stock,
        }

    def test__filter_emergency_fund__returns_only_eligible(
        self, client, mixed_assets_for_emergency_fund
    ):
        # GIVEN
        assets = mixed_assets_for_emergency_fund

        # WHEN
        response = client.get(f"{URL}?emergency_fund=true")

        # THEN
        assert response.status_code == HTTP_200_OK
        assert response.json()["count"] == 1

        result_codes = [r["code"] for r in response.json()["results"]]
        assert assets["daily_fixed"].code in result_codes
        assert assets["future_maturity"].code not in result_codes
        assert assets["empty_liquidity"].code not in result_codes
        assert assets["stock"].code not in result_codes


class TestEmergencyFundFilterIncludesMaturedAssets:
    """Test that AT_MATURITY assets with maturity in past/current month are included."""

    @pytest.fixture
    def matured_at_maturity_asset(self, user):
        """Create an AT_MATURITY asset that has matured (via AssetReadModel)."""
        return AssetReadModelFactory(
            write_model_pk=100,
            user_id=user.pk,
            code="lci-matured",
            type=AssetTypes.fixed_br,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type=LiquidityTypes.at_maturity,
            maturity_date=timezone.localdate() - relativedelta(months=1),  # Last month
            quantity_balance=Decimal("100.00"),
        )

    def test__filter_emergency_fund__includes_matured_at_maturity(
        self, client, matured_at_maturity_asset
    ):
        # GIVEN - asset with maturity in the past

        # WHEN
        response = client.get(f"{URL}?emergency_fund=true")

        # THEN
        assert response.status_code == HTTP_200_OK
        assert response.json()["count"] == 1
        assert response.json()["results"][0]["code"] == matured_at_maturity_asset.code


class TestCQRSSyncForLiquidityFields:
    """Test that CQRS sync includes liquidity_type and maturity_date."""

    def test__cqrs_sync__includes_liquidity_fields(self, client, user):
        # GIVEN
        future_date = timezone.localdate() + relativedelta(months=6)
        data = {
            "type": AssetTypes.fixed_br,
            "objective": AssetObjectives.dividend,
            "currency": Currencies.real,
            "description": "CQRS Test CDB",
            "code": "CQRS-TEST-CDB",
            "is_held_in_self_custody": False,
            "liquidity_type": LiquidityTypes.at_maturity,
            "maturity_date": future_date.strftime("%d/%m/%Y"),
        }

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_201_CREATED

        # Get the created asset
        asset = Asset.objects.get(user=user)

        # Trigger CQRS sync manually
        SyncAssetReadModelCommand().handle(
            user_ids=list(CustomUser.objects.values_list("pk", flat=True))
        )

        # Verify AssetReadModel has the fields
        assert AssetReadModel.objects.filter(
            write_model_pk=asset.pk,
            user_id=user.pk,
            liquidity_type=LiquidityTypes.at_maturity,
            maturity_date=future_date,
        ).exists()


class TestUpdateAssetDescription:
    """Test updating the description field on an asset."""

    @pytest.fixture
    def asset_with_description(self, user):
        """Create an asset with initial description."""
        return AssetFactory(
            code="test-asset",
            description="Initial description",
            type=AssetTypes.fixed_br,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type=LiquidityTypes.daily,
            user=user,
        )

    def test__update_description__succeeds(self, client, asset_with_description):
        # GIVEN
        asset = asset_with_description
        new_description = "Updated description for CDB"
        data = {
            "type": asset.type,
            "objective": asset.objective,
            "currency": asset.currency,
            "code": asset.code,
            "description": new_description,
            "liquidity_type": asset.liquidity_type,
        }

        # WHEN
        response = client.put(f"{URL}/{asset.pk}", data=data)

        # THEN
        assert response.status_code == HTTP_200_OK

        asset.refresh_from_db()
        assert asset.description == new_description

    def test__update_description__to_empty_succeeds(self, client, asset_with_description):
        # GIVEN
        asset = asset_with_description
        data = {
            "type": asset.type,
            "objective": asset.objective,
            "currency": asset.currency,
            "code": asset.code,
            "description": "",
            "liquidity_type": asset.liquidity_type,
        }

        # WHEN
        response = client.put(f"{URL}/{asset.pk}", data=data)

        # THEN
        assert response.status_code == HTTP_200_OK

        asset.refresh_from_db()
        assert asset.description == ""


class TestUpdateMaturityDateFormat:
    """Test updating maturity_date with DD/MM/YYYY format."""

    @pytest.fixture
    def fixed_br_asset_with_maturity(self, user):
        """Create a FIXED_BR asset with maturity date."""
        return AssetFactory(
            code="lci-test",
            description="LCI Test",
            type=AssetTypes.fixed_br,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type=LiquidityTypes.at_maturity,
            maturity_date=timezone.localdate() + relativedelta(months=6),
            user=user,
        )

    def test__update_maturity_date__with_dd_mm_yyyy_format(
        self, client, fixed_br_asset_with_maturity
    ):
        # GIVEN
        asset = fixed_br_asset_with_maturity
        new_date = timezone.localdate() + relativedelta(months=12)
        data = {
            "type": asset.type,
            "objective": asset.objective,
            "currency": asset.currency,
            "code": asset.code,
            "description": asset.description,
            "liquidity_type": asset.liquidity_type,
            "maturity_date": new_date.strftime("%d/%m/%Y"),  # DD/MM/YYYY format
        }

        # WHEN
        response = client.put(f"{URL}/{asset.pk}", data=data)

        # THEN
        assert response.status_code == HTTP_200_OK

        asset.refresh_from_db()
        assert asset.maturity_date == new_date

    def test__update_maturity_date__clear_to_null(self, client, fixed_br_asset_with_maturity):
        # GIVEN
        asset = fixed_br_asset_with_maturity
        data = {
            "type": asset.type,
            "objective": asset.objective,
            "currency": asset.currency,
            "code": asset.code,
            "description": asset.description,
            "liquidity_type": asset.liquidity_type,
            "maturity_date": None,
        }

        # WHEN
        response = client.put(f"{URL}/{asset.pk}", data=data)

        # THEN
        assert response.status_code == HTTP_200_OK

        asset.refresh_from_db()
        assert asset.maturity_date is None

    def test__update_maturity_date__wrong_format_fails(self, client, fixed_br_asset_with_maturity):
        # GIVEN - date in ISO format (YYYY-MM-DD) instead of DD/MM/YYYY
        asset = fixed_br_asset_with_maturity
        new_date = timezone.localdate() + relativedelta(months=12)
        data = {
            "type": asset.type,
            "objective": asset.objective,
            "currency": asset.currency,
            "code": asset.code,
            "description": asset.description,
            "liquidity_type": asset.liquidity_type,
            "maturity_date": new_date.strftime("%Y-%m-%d"),  # Wrong format!
        }

        # WHEN
        response = client.put(f"{URL}/{asset.pk}", data=data)

        # THEN
        assert response.status_code == HTTP_400_BAD_REQUEST
        assert "maturity_date" in response.json()
        assert "DD/MM/YYYY" in response.json()["maturity_date"][0]


class TestEmergencyFundTotalEndpoint:
    """Test the emergency-fund-total endpoint aggregation."""

    TOTAL_URL = f"{URL}/emergency-fund-total"

    def test__emergency_fund_total__no_assets_returns_zero(self, client):
        # GIVEN - no assets

        # WHEN
        response = client.get(self.TOTAL_URL)

        # THEN
        assert response.status_code == HTTP_200_OK
        assert Decimal(str(response.json()["total"])) == Decimal("0.00")

    def test__emergency_fund_total__sums_only_eligible_assets(self, client, user):
        # GIVEN - mix of assets with different totals
        # FIXED_BR with DAILY liquidity (should be included)
        metadata1 = AssetMetaDataFactory(
            code="cdb-daily",
            type=AssetTypes.fixed_br,
            currency=Currencies.real,
            current_price=Decimal("10.00"),
        )
        AssetReadModelFactory(
            write_model_pk=1,
            user_id=user.pk,
            code="cdb-daily",
            type=AssetTypes.fixed_br,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type=LiquidityTypes.daily,
            maturity_date=None,
            quantity_balance=Decimal("100.00"),
            normalized_avg_price=Decimal("10.00"),
            metadata=metadata1,
        )

        # FIXED_BR with AT_MATURITY and future date (should NOT be included)
        metadata2 = AssetMetaDataFactory(
            code="lci-future",
            type=AssetTypes.fixed_br,
            currency=Currencies.real,
            current_price=Decimal("20.00"),
        )
        AssetReadModelFactory(
            write_model_pk=2,
            user_id=user.pk,
            code="lci-future",
            type=AssetTypes.fixed_br,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type=LiquidityTypes.at_maturity,
            maturity_date=timezone.localdate() + relativedelta(years=1),
            quantity_balance=Decimal("200.00"),
            normalized_avg_price=Decimal("20.00"),
            metadata=metadata2,
        )

        # STOCK asset (should NOT be included)
        metadata3 = AssetMetaDataFactory(
            code="PETR4",
            type=AssetTypes.stock,
            currency=Currencies.real,
            current_price=Decimal("30.00"),
        )
        AssetReadModelFactory(
            write_model_pk=3,
            user_id=user.pk,
            code="PETR4",
            type=AssetTypes.stock,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type="",
            quantity_balance=Decimal("300.00"),
            normalized_avg_price=Decimal("30.00"),
            metadata=metadata3,
        )

        # WHEN
        response = client.get(self.TOTAL_URL)

        # THEN
        assert response.status_code == HTTP_200_OK
        # Only cdb-daily should be included: 100 * 10 = 1000
        assert Decimal(str(response.json()["total"])) == Decimal("1000.00")

    def test__emergency_fund_total__includes_matured_at_maturity(self, client, user):
        # GIVEN - AT_MATURITY asset that has matured
        metadata = AssetMetaDataFactory(
            code="lci-matured",
            type=AssetTypes.fixed_br,
            currency=Currencies.real,
            current_price=Decimal("10.00"),
        )
        AssetReadModelFactory(
            write_model_pk=1,
            user_id=user.pk,
            code="lci-matured",
            type=AssetTypes.fixed_br,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type=LiquidityTypes.at_maturity,
            maturity_date=timezone.localdate() - relativedelta(months=1),
            quantity_balance=Decimal("50.00"),
            normalized_avg_price=Decimal("10.00"),
            metadata=metadata,
        )

        # WHEN
        response = client.get(self.TOTAL_URL)

        # THEN
        assert response.status_code == HTTP_200_OK
        # Matured asset should be included: 50 * 10 = 500
        assert Decimal(str(response.json()["total"])) == Decimal("500.00")

    def test__emergency_fund_total__excludes_other_users_assets(self, client, user):
        # GIVEN - asset from another user
        other_user = UserFactory()
        metadata = AssetMetaDataFactory(
            code="other-user-cdb",
            type=AssetTypes.fixed_br,
            currency=Currencies.real,
            current_price=Decimal("100.00"),
        )
        AssetReadModelFactory(
            write_model_pk=1,
            user_id=other_user.pk,
            code="other-user-cdb",
            type=AssetTypes.fixed_br,
            objective=AssetObjectives.dividend,
            currency=Currencies.real,
            liquidity_type=LiquidityTypes.daily,
            quantity_balance=Decimal("1000.00"),
            normalized_avg_price=Decimal("100.00"),
            metadata=metadata,
        )

        # WHEN
        response = client.get(self.TOTAL_URL)

        # THEN
        assert response.status_code == HTTP_200_OK
        assert Decimal(str(response.json()["total"])) == Decimal("0.00")
