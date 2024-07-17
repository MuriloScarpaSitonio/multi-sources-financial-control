import operator
from decimal import ROUND_HALF_UP, Decimal
from random import randrange

from django.db.models import F
from django.utils import timezone

import pytest
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
)

from config.settings.base import BASE_API_URL
from shared.tests import convert_and_quantitize

from ...choices import AssetObjectives, AssetSectors, AssetTypes, Currencies
from ...models import Asset, AssetMetaData, AssetReadModel, PassiveIncome, Transaction
from ..shared import (
    get_avg_price_bute_force,
    get_closed_operations_totals,
    get_current_adjusted_avg_price_brute_forte,
    get_current_price_metadata,
    get_current_roi_brute_force,
    get_current_total_bought_brute_force,
    get_current_total_invested_brute_force,
    get_quantity_balance_brute_force,
    get_roi_brute_force,
    get_total_invested_brute_force,
)

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets"


@pytest.mark.parametrize(
    ("asset_type", "asset_sector", "currency", "mock_path"),
    (
        (
            AssetTypes.fii,
            AssetSectors.essential_consumption,
            Currencies.real,
            "variable_income_assets.integrations.helpers.get_b3_prices",
        ),
        (
            AssetTypes.stock,
            AssetSectors.unknown,
            Currencies.real,
            "variable_income_assets.integrations.helpers.get_b3_prices",
        ),
        (
            AssetTypes.stock_usa,
            AssetSectors.unknown,
            Currencies.dollar,
            "variable_income_assets.integrations.helpers.get_stocks_usa_prices",
        ),
        (
            AssetTypes.crypto,
            AssetSectors.tech,
            Currencies.dollar,
            "variable_income_assets.integrations.helpers.get_crypto_prices",
        ),
        (
            AssetTypes.crypto,
            AssetSectors.tech,
            Currencies.real,
            "variable_income_assets.integrations.helpers.get_crypto_prices",
        ),
    ),
)
def test__create(client, asset_type, asset_sector, currency, mock_path, mocker):
    # GIVEN
    code = "IGR"
    objective = AssetObjectives.dividend
    current_price = Decimal(randrange(155, 389)) / 100
    mocker.patch(mock_path, return_value={code: current_price})

    # WHEN
    response = client.post(
        URL, data={"type": asset_type, "objective": objective, "currency": currency, "code": code}
    )

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert (
        AssetReadModel.objects.filter(
            code=code,
            type=asset_type,
            objective=objective,
            currency=currency,
            quantity_balance=0,
            avg_price=0,
            normalized_avg_price=0,
            normalized_total_bought=0,
            normalized_total_sold=0,
            normalized_closed_roi=0,
            normalized_credited_incomes=0,
            credited_incomes=0,
            metadata__isnull=False,
        ).count()
        == 1
    )
    assert (
        AssetMetaData.objects.filter(
            code=code,
            type=asset_type,
            currency=currency,
            sector=asset_sector,
            current_price_updated_at__isnull=False,
            current_price=current_price,
        ).count()
        == 1
    )


@pytest.mark.parametrize(
    ("type", "currency", "status_code"),
    (
        (AssetTypes.crypto, Currencies.real, HTTP_201_CREATED),
        (AssetTypes.crypto, Currencies.dollar, HTTP_201_CREATED),
        (AssetTypes.stock, Currencies.real, HTTP_201_CREATED),
        (AssetTypes.stock, Currencies.dollar, HTTP_400_BAD_REQUEST),
        (AssetTypes.fii, Currencies.real, HTTP_201_CREATED),
        (AssetTypes.fii, Currencies.dollar, HTTP_400_BAD_REQUEST),
        (AssetTypes.stock_usa, Currencies.real, HTTP_400_BAD_REQUEST),
        (AssetTypes.stock_usa, Currencies.dollar, HTTP_201_CREATED),
    ),
)
def test__create__validate_currency(client, type, currency, status_code, mocker):
    # GIVEN
    mocker.patch("variable_income_assets.views.messagebus.handle")
    data = {
        "type": type,
        "objective": AssetObjectives.growth,
        "code": "TTT",
        "currency": currency,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == status_code
    if status_code == HTTP_400_BAD_REQUEST:
        assert response.json() == {
            "currency__type": [f"{currency} is not valid for an asset of type {type}"]
        }


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("crypto_asset_metadata")
def test__create__code_type_diff_currencies__crypto(client, crypto_asset, sync_assets_read_model):
    # GIVEN
    data = {
        "type": crypto_asset.type,
        "objective": crypto_asset.objective,
        "code": crypto_asset.code,
        "currency": Currencies.real,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert AssetReadModel.objects.filter(code=crypto_asset.code).count() == 2
    assert AssetMetaData.objects.filter(code=crypto_asset.code).count() == 2


def test__create__code_type_currency_user_unique(client, crypto_asset):
    # GIVEN
    data = {
        "type": crypto_asset.type,
        "objective": crypto_asset.objective,
        "code": crypto_asset.code,
        "currency": Currencies.dollar,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "code__currency__type__user__unique": [
            "You can't have two assets with the same code, currency and type"
        ]
    }


def test__create__uppercase_code(client, mocker):
    # GIVEN
    mocker.patch("variable_income_assets.views.messagebus.handle")
    data = {
        "type": AssetTypes.stock,
        "objective": AssetObjectives.dividend,
        "currency": Currencies.real,
        "code": "bbas3",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Asset.objects.filter(code="BBAS3").exists()


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("sync_assets_read_model", "crypto_asset_metadata")
def test__update(client, crypto_asset):
    # GIVEN
    code = "RANI4"
    data = {
        "type": AssetTypes.stock,
        "objective": AssetObjectives.dividend,
        "code": code,
        "currency": Currencies.real,
    }

    # WHEN
    response = client.put(f"{URL}/{crypto_asset.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    crypto_asset.refresh_from_db()
    read = AssetReadModel.objects.get(write_model_pk=crypto_asset.pk)

    assert crypto_asset.type == read.type == AssetTypes.stock
    assert crypto_asset.objective == read.objective == AssetObjectives.dividend
    assert crypto_asset.code == read.code == code
    assert crypto_asset.currency == read.currency == Currencies.real

    assert read.metadata_id == (
        AssetMetaData.objects.only("pk")
        .get(code=code, type=AssetTypes.stock, currency=Currencies.real)
        .pk
    )


def test__update__asset_does_not_belong_to_user(kucoin_client, stock_asset):
    # GIVEN
    data = {"type": stock_asset.type, "objective": AssetObjectives.growth, "code": stock_asset.code}

    # WHEN
    response = kucoin_client.put(f"{URL}/{stock_asset.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Not found."}


def test__update__validate_currency(client, stock_asset):
    # GIVEN
    data = {
        "type": stock_asset.type,
        "objective": stock_asset.objective,
        "code": stock_asset.code,
        "currency": Currencies.dollar,
    }

    # WHEN
    response = client.put(f"{URL}/{stock_asset.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST


def test__update__uppercase_code(client, stock_asset, mocker):
    # GIVEN
    mocker.patch("variable_income_assets.views.messagebus.handle")
    data = {
        "type": stock_asset.type,
        "objective": stock_asset.objective,
        "code": stock_asset.code.lower(),
        "currency": stock_asset.currency,
    }

    # WHEN
    response = client.put(f"{URL}/{stock_asset.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    assert Asset.objects.filter(code=stock_asset.code.upper()).exists()


@pytest.mark.usefixtures(
    "stock_asset_metadata",
    "stock_asset",
    "another_stock_asset",
    "another_stock_asset_transactions",
    "another_stock_asset_metadata",
    "another_stock_asset_closed_operation",
    "sync_assets_read_model",
)
@pytest.mark.parametrize(
    "filter_by, count",
    (
        ("", 2),
        ("code=ALUP", 1),
        # ("ROI_type=PROFIT", 1),
        # ("ROI_type=LOSS", 0),
        ("type=STOCK", 2),
        ("type=STOCK_USA", 0),
        ("sector=UTILITIES", 1),
        ("status=OPENED", 1),
        ("status=CLOSED", 1),
    ),
)
def test__list__filters(client, filter_by, count):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}?{filter_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == count


@pytest.mark.parametrize(
    "fixture, operation",
    (
        ("profit_asset_bought_transactions", operator.gt),
        ("loss_asset_bought_transactions", operator.lt),
        ("profit_asset_bought_transactions_incomes", operator.gt),
        ("loss_asset_bought_transactions_incomes_profit", operator.gt),
        ("loss_asset_bought_transactions_incomes_loss", operator.lt),
        ("profit_asset_both_transactions", operator.gt),
        ("loss_asset_both_transactions", operator.lt),
        ("profit_asset_both_transactions_incomes", operator.gt),
        ("loss_asset_both_transactions_incomes_profit", operator.gt),
        ("loss_asset_both_transactions_incomes_loss", operator.lt),
        ("loss_asset_previously_closed_w_profit_loss", operator.lt),
        ("loss_asset_previously_closed_w_incomes_and_profit_loss", operator.lt),
        # ("profit_asset_closed", operator.gt),
    ),
)
def test__list__aggregations(client, stock_asset, fixture, operation, request):
    # GIVEN
    request.getfixturevalue(fixture)
    request.getfixturevalue("sync_assets_read_model")

    roi = get_current_roi_brute_force(asset=stock_asset)
    avg_price = get_current_adjusted_avg_price_brute_forte(asset=stock_asset)
    total_bought = get_current_total_bought_brute_force(asset=stock_asset)
    if not total_bought:
        _, total_bought = get_closed_operations_totals(stock_asset, normalize=True)

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    results = response.json()["results"][0]
    assert convert_and_quantitize(results["normalized_roi"]) == convert_and_quantitize(roi)
    assert operation(roi, 0)
    assert convert_and_quantitize(
        results["roi_percentage"], decimal_places=3
    ) == convert_and_quantitize((float(roi) / float(total_bought)) * 100, decimal_places=3)
    assert convert_and_quantitize(results["adjusted_avg_price"]) == convert_and_quantitize(
        avg_price
    )


@pytest.mark.parametrize(
    "fixture, operation",
    (
        ("profit_asset_usa_bought_transactions", operator.gt),
        ("loss_asset_usa_bought_transactions", operator.lt),
        ("loss_asset_usa_bought_transactions_incomes_profit", operator.gt),
        ("loss_asset_usa_bought_transactions_incomes_loss", operator.lt),
        ("profit_asset_usa_both_transactions", operator.gt),
        ("loss_asset_usa_both_transactions", operator.lt),
        ("loss_asset_usa_both_transactions_incomes_profit", operator.gt),
        ("loss_asset_usa_both_transactions_incomes_loss", operator.lt),
        ("loss_asset_usa_previously_closed_w_profit_loss", operator.lt),
        ("loss_asset_usa_previously_closed_w_incomes_and_profit_loss", operator.lt),
    ),
)
def test__list__aggregations__dollar(client, stock_usa_asset: Asset, fixture, operation, request):
    # GIVEN
    request.getfixturevalue(fixture)
    request.getfixturevalue("sync_assets_read_model")

    roi = get_current_roi_brute_force(asset=stock_usa_asset)
    avg_price = get_current_adjusted_avg_price_brute_forte(asset=stock_usa_asset, normalize=False)
    total_bought = get_current_total_bought_brute_force(asset=stock_usa_asset)

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    results = response.json()["results"][0]
    assert convert_and_quantitize(results["normalized_roi"]) == convert_and_quantitize(roi)
    assert operation(roi, 0)
    assert convert_and_quantitize(
        results["roi_percentage"], decimal_places=3
    ) == convert_and_quantitize((float(roi) / float(total_bought)) * 100, decimal_places=3)
    assert convert_and_quantitize(results["adjusted_avg_price"]) == convert_and_quantitize(
        avg_price
    )


@pytest.mark.usefixtures("indicators_data", "sync_assets_read_model")
def test_list_assets_aggregate_data(client):
    # GIVEN
    total_invested_brute_force = sum(
        get_total_invested_brute_force(asset) for asset in Asset.objects.all()
    )

    # WHEN
    response = client.get(f"{URL}?status=OPENED")

    # THEN
    for result in response.json()["results"]:
        asset = Asset.objects.get(code=result["code"])
        qty = get_quantity_balance_brute_force(asset=asset)
        total_invested = get_avg_price_bute_force(asset=asset, normalize=True) * qty
        percentage_invested = (
            (total_invested / total_invested_brute_force) * Decimal("100.0")
        ).quantize(Decimal(".1"), rounding=ROUND_HALF_UP)

        assert convert_and_quantitize(
            result["normalized_total_invested"]
        ) == convert_and_quantitize(total_invested)
        assert (
            Decimal(str(result["percentage_invested"])).quantize(
                Decimal(".1"), rounding=ROUND_HALF_UP
            )
            == percentage_invested
        )


def test__list__should_include_asset_wo_transactions(
    client,
    stock_usa_asset,
    stock_usa_asset_metadata,
    crypto_asset,
    crypto_transaction,
    crypto_asset_metadata,
    another_stock_asset,
    another_stock_asset_metadata,
    fii_asset,
    fii_asset_metadata,
    sync_assets_read_model,
):
    # GIVEN
    expected = {
        stock_usa_asset.code: Currencies.dollar,
        crypto_asset.code: Currencies.dollar,
        another_stock_asset.code: Currencies.real,
        fii_asset.code: Currencies.real,
    }

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == 4
    assert {r["code"]: r["currency"] for r in response.json()["results"]} == expected


@pytest.mark.usefixtures("indicators_data", "sync_assets_read_model")
def test__indicators(client):
    # GIVEN
    current_total = sum(
        get_current_total_invested_brute_force(asset) for asset in Asset.objects.opened()
    )
    roi_opened = sum(get_current_roi_brute_force(asset=asset) for asset in Asset.objects.opened())
    roi_closed = sum(get_roi_brute_force(asset=asset) for asset in Asset.objects.closed())

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["total"] == convert_and_quantitize(current_total)
    assert response.json()["ROI_opened"] == convert_and_quantitize(roi_opened)
    assert response.json()["ROI_closed"] == convert_and_quantitize(roi_closed)


@pytest.mark.parametrize("filters", ("", "status=OPENED", "status=CLOSED"))
@pytest.mark.usefixtures(
    "transactions",
    "crypto_transaction",
    "another_stock_asset",  # closed
    "another_stock_asset_transactions",
    "stock_usa_transaction",
    "stock_asset",  # has transactions
    "crypto_asset",  # has transactions
    "stock_usa_asset",  # has transactions
    "yet_another_stock_asset",  # no transactions
    "another_stock_usa_asset",  # no transactions
    "another_crypto_asset",  # no transactions
    "fii_asset",  # no transactions
)
def test__minimal_data_endpoint(client, filters):
    # GIVEN
    qs = AssetReadModel.objects.annotate(pk=F("write_model_pk"))
    if "OPENED" in filters:
        qs = qs.opened()
    if "CLOSED" in filters:
        qs = qs.closed()

    # WHEN
    response = client.get(f"{URL}/minimal_data?{filters}")

    # THEN
    assert response.status_code == 200
    assert response.json() == list(qs.values("code", "currency", "pk").order_by("code"))


@pytest.mark.usefixtures(
    "transactions", "passive_incomes", "stock_asset_metadata", "sync_assets_read_model"
)
def test__delete(client, stock_asset):
    # GIVEN

    # WHEN
    response = client.delete(f"{URL}/{stock_asset.pk}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT
    assert (
        Asset.objects.count()
        == Transaction.objects.count()
        == PassiveIncome.objects.count()
        == AssetReadModel.objects.count()
        == 0
    )


def test__forbidden__module_not_enabled(user, client):
    # GIVEN
    user.is_investments_module_enabled = False
    user.is_investments_integrations_module_enabled = False
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Você não tem acesso ao módulo de investimentos"}


def test__forbidden__subscription_ended(client, user):
    # GIVEN
    user.subscription_ends_at = timezone.now()
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Sua assinatura expirou"}


def test__unauthorized__inactive(client, user):
    # GIVEN
    user.is_active = False
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED
