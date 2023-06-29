from decimal import ROUND_HALF_UP, Decimal
import operator
from random import randrange

import pytest

from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
)

from authentication.tests.conftest import (
    binance_client,
    client,
    kucoin_client,
    binance_secrets,
    kucoin_secrets,
    secrets,
    user,
    user_with_binance_integration,
    user_with_kucoin_integration,
)
from config.settings.base import BASE_API_URL

from variable_income_assets.tests.shared import (
    convert_and_quantitize,
    convert_to_percentage_and_quantitize,
    get_adjusted_avg_price_brute_forte,
    get_quantity_balance_brute_force,
    get_avg_price_bute_force,
    get_current_price_metadata,
    get_current_total_invested_brute_force,
    get_roi_brute_force,
    get_total_bought_brute_force,
    get_total_invested_brute_force,
)
from variable_income_assets.choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    TransactionCurrencies,
)
from variable_income_assets.models import (
    Asset,
    AssetMetaData,
    AssetReadModel,
    PassiveIncome,
    Transaction,
)


pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets"


@pytest.mark.parametrize(
    ("asset_type", "asset_sector"),
    (
        (AssetTypes.fii, AssetSectors.essential_consumption),
        (AssetTypes.stock, AssetSectors.unknown),
        (AssetTypes.stock_usa, AssetSectors.unknown),
        (AssetTypes.crypto, AssetSectors.tech),
    ),
)
def test__create(client, asset_type, asset_sector, mocker):
    # GIVEN
    code = "IGR"
    objective = AssetObjectives.dividend
    current_price = Decimal(randrange(155, 389)) / 100
    mocker.patch(
        "variable_income_assets.tasks.asset_metadata.fetch_asset_current_price",
        return_value=current_price,
    ),

    # WHEN
    response = client.post(URL, data={"type": asset_type, "objective": objective, "code": "IGR"})

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert (
        AssetReadModel.objects.filter(
            code=code,
            type=asset_type,
            objective=objective,
            currency="",
            quantity_balance=0,
            avg_price=0,
            total_bought=0,
            total_invested=0,
            total_invested_adjusted=0,
            metadata__isnull=False,
        ).count()
        == 1
    )
    for currency in AssetTypes.get_choice(asset_type).valid_currencies:
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


def test__create__same_code(client, stock_asset):
    # GIVEN
    data = {"type": AssetTypes.fii, "objective": AssetObjectives.dividend, "code": stock_asset.code}

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"code": ["Asset with given code already exists"]}


@pytest.mark.skip("Skip while is not implemented")
def test__create__wrong_sector_type_set(client):
    # GIVEN
    data = {
        "type": AssetTypes.fii,
        "sector": AssetSectors.industrials,
        "objective": AssetObjectives.dividend,
        "code": "IGR",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "type_sector": [
            f"{AssetTypes.fii} is not a valid type of asset for the "
            f"{AssetSectors.industrials} sector. Valid choices: {AssetTypes.stock}, {AssetTypes.stock_usa}"
        ]
    }


@pytest.mark.usefixtures("sync_assets_read_model", "stock_asset_metadata")
def test__update(client, stock_asset):
    # GIVEN
    data = {"type": stock_asset.type, "objective": AssetObjectives.growth, "code": stock_asset.code}

    # WHEN
    response = client.put(f"{URL}/{stock_asset.code}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    stock_asset.refresh_from_db()
    assert stock_asset.objective == AssetObjectives.growth
    assert (
        AssetReadModel.objects.get(write_model_pk=stock_asset.pk).objective
        == AssetObjectives.growth
    )


def test__update__asset_does_not_belong_to_user(kucoin_client, stock_asset):
    # GIVEN
    data = {"type": stock_asset.type, "objective": AssetObjectives.growth, "code": stock_asset.code}

    # WHEN
    response = kucoin_client.put(f"{URL}/{stock_asset.code}", data=data)

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Not found."}


@pytest.mark.usefixtures("stock_asset_metadata", "stock_asset", "sync_assets_read_model")
@pytest.mark.parametrize(
    "filter_by, count",
    (
        ("", 1),
        ("code=ALUP", 1),
        # # ("ROI_type=PROFIT", 1),
        # # ("ROI_type=LOSS", 0),
        ("type=STOCK", 1),
        ("type=STOCK_USA", 0),
        ("sector=UTILITIES", 1),
    ),
)
def test___list__filters(client, filter_by, count):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}?{filter_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == count


# 1 - ativo fechado, lucro
# 2 - ativo fechado, prejuízo
# 3 - ativo fechado, lucro + incomes
# 4 - ativo fechado, prejuízo + incomes = prejuízo
# 5 - ativo fechado, prejuízo + incomes = lucro


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
    ),
)
def test___list__aggregations(client, stock_asset, fixture, operation, request):
    # GIVEN
    request.getfixturevalue(fixture)
    request.getfixturevalue("sync_assets_read_model")

    roi = get_roi_brute_force(asset=stock_asset)
    avg_price = get_adjusted_avg_price_brute_forte(asset=stock_asset)
    total_bought = get_total_bought_brute_force(asset=stock_asset)

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    results = response.json()["results"][0]
    assert results["roi"] == float(roi)
    assert operation(roi, 0)
    assert results["roi_percentage"] == round((float(roi) / float(total_bought)) * 100, 6)
    assert results["adjusted_avg_price"] == float(avg_price)


# TODO: REPETIR para transações em dólar


@pytest.mark.usefixtures("indicators_data", "sync_assets_read_model")
def test_list_assets_aggregate_data(client):
    # GIVEN
    total_invested_brute_force = sum(
        (get_total_invested_brute_force(asset) for asset in Asset.objects.all())
    )
    current_total_brute_force = sum(
        (get_current_total_invested_brute_force(asset) for asset in Asset.objects.all())
    )

    # WHEN
    response = client.get(URL)

    # THEN
    for result in response.json()["results"]:
        asset = Asset.objects.get(code=result["code"])
        qty = get_quantity_balance_brute_force(asset=asset)
        total_invested = get_avg_price_bute_force(asset=asset, normalize=True) * qty
        percentage_invested = (
            (total_invested / total_invested_brute_force) * Decimal("100.0")
        ).quantize(Decimal(".1"), rounding=ROUND_HALF_UP)

        current_invested = get_current_price_metadata(asset, normalize=True) * qty
        current_percentage = (
            (current_invested / current_total_brute_force) * Decimal("100.0")
        ).quantize(Decimal(".1"), rounding=ROUND_HALF_UP)

        assert Decimal(str(result["total_invested"])).quantize(
            Decimal(".1"), rounding=ROUND_HALF_UP
        ) == convert_and_quantitize(total_invested)
        assert (
            Decimal(str(result["percentage_invested"])).quantize(
                Decimal(".1"), rounding=ROUND_HALF_UP
            )
            == percentage_invested
        )
        assert (
            Decimal(str(result["current_percentage"])).quantize(
                Decimal(".1"), rounding=ROUND_HALF_UP
            )
            == current_percentage
        )
        if result["roi"] < 0:
            assert result["percentage_invested"] > result["current_percentage"]

        elif result["roi"] > 0:
            assert result["percentage_invested"] < result["current_percentage"]


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
        stock_usa_asset.code: TransactionCurrencies.dollar,
        crypto_asset.code: TransactionCurrencies.dollar,
        another_stock_asset.code: TransactionCurrencies.real,
        fii_asset.code: TransactionCurrencies.real,
    }

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == 4
    assert {r["code"]: r["currency"] for r in response.json()["results"]} == expected


@pytest.mark.skip("Integration is deprecated")
def test_should_call_sync_cei_transactions_task_task(client, user, mocker):
    # GIVEN
    mocked_task = mocker.patch("variable_income_assets.views.sync_cei_transactions_task")

    # WHEN
    response = client.get(f"{URL}/sync_cei_transactions")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["username"] == user.username


def test_should_raise_permission_error_sync_cei_transactions_if_user_has_not_set_credentials(
    binance_client,
):
    # GIVEN

    # WHEN
    response = binance_client.get(f"{URL}/sync_cei_transactions")

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {
        "detail": "User has not set the given credentials for CEI integration"
    }


def test_should_call_sync_kucoin_transactions_task(
    kucoin_client, user_with_kucoin_integration, mocker
):
    # GIVEN
    mocked_task = mocker.patch("variable_income_assets.views.sync_kucoin_transactions_task")

    # WHEN
    response = kucoin_client.get(f"{URL}/sync_kucoin_transactions")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["username"] == user_with_kucoin_integration.username


def test_should_raise_permission_error_sync_kucoin_transactions_if_user_has_not_set_credentials(
    client,
):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/sync_kucoin_transactions")

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {
        "detail": "User has not set the given credentials for KuCoin integration"
    }


def test_should_call_sync_binance_transactions_task_task(
    binance_client, user_with_binance_integration, mocker
):
    # GIVEN
    mocked_task = mocker.patch("variable_income_assets.views.sync_binance_transactions_task")

    # WHEN
    response = binance_client.get(f"{URL}/sync_binance_transactions")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["username"] == user_with_binance_integration.username


def test_should_raise_permission_error_sync_binance_if_user_has_not_set_credentials(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/sync_binance_transactions")

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {
        "detail": "User has not set the given credentials for Binance integration"
    }


@pytest.mark.skip("Integration is deprecated")
def test_should_call_sync_cei_passive_incomes_task_task(client, user, mocker):
    # GIVEN
    mocked_task = mocker.patch("variable_income_assets.views.sync_cei_passive_incomes_task")

    # WHEN
    response = client.get(f"{URL}/sync_cei_passive_incomes")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["username"] == user.username


def test_should_raise_permission_error_sync_cei_passive_incomes_if_user_has_not_set_credentials(
    binance_client,
):
    # GIVEN

    # WHEN
    response = binance_client.get(f"{URL}/sync_cei_passive_incomes")

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {
        "detail": "User has not set the given credentials for CEI integration"
    }


@pytest.mark.usefixtures("indicators_data", "sync_assets_read_model")
def test_should_get_indicators(client):
    # GIVEN
    current_total = sum(
        get_current_total_invested_brute_force(asset) for asset in Asset.objects.all()
    )
    roi_opened = sum(get_roi_brute_force(asset=asset) for asset in Asset.objects.opened())
    roi_finished = sum(get_roi_brute_force(asset=asset) for asset in Asset.objects.finished())

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["total"] == convert_and_quantitize(current_total)
    assert response.json()["ROI_opened"] == convert_and_quantitize(roi_opened)
    assert response.json()["ROI_finished"] == convert_and_quantitize(roi_finished)
    assert response.json()["ROI"] == convert_and_quantitize(roi_opened + roi_finished)


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
@pytest.mark.parametrize(
    "group_by, choices_class",
    (("TYPE", AssetTypes), ("SECTOR", AssetSectors), ("OBJECTIVE", AssetObjectives)),
)
def test__total_invested_report(client, group_by, choices_class):
    # GIVEN
    if group_by == "SECTOR":
        field = "metadata__sector"
    else:
        field = group_by.lower()
    totals = {
        v: sum(
            get_total_invested_brute_force(Asset.objects.get(pk=asset.write_model_pk))
            for asset in AssetReadModel.objects.filter(**{field: v})
        )
        for v in choices_class.values
    }

    # WHEN
    response = client.get(
        f"{URL}/total_invested_report?percentage=false&current=false&group_by={group_by}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    for result in response.json():
        for choice, label in choices_class.choices:
            if label == result[group_by.lower()]:
                assert convert_and_quantitize(totals[choice]) == result["total"]


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
@pytest.mark.parametrize(
    "group_by, choices_class",
    (("TYPE", AssetTypes), ("SECTOR", AssetSectors), ("OBJECTIVE", AssetObjectives)),
)
def test__total_invested_report__percentage(client, group_by, choices_class):
    # GIVEN
    total_invested = sum(get_total_invested_brute_force(asset) for asset in Asset.objects.all())
    if group_by == "SECTOR":
        field = "metadata__sector"
    else:
        field = group_by.lower()
    totals = {
        v: sum(
            get_total_invested_brute_force(Asset.objects.get(pk=asset.write_model_pk))
            for asset in AssetReadModel.objects.filter(**{field: v})
        )
        for v in choices_class.values
    }

    # WHEN
    response = client.get(
        f"{URL}/total_invested_report?percentage=true&current=false&group_by={group_by}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    for result in response.json():
        for choice, label in choices_class.choices:
            if label == result[group_by.lower()]:
                assert (
                    float(
                        convert_to_percentage_and_quantitize(
                            value=totals[choice], total=total_invested
                        )
                    )
                    == result["total"]
                )


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
@pytest.mark.parametrize(
    "group_by, choices_class",
    (("TYPE", AssetTypes), ("SECTOR", AssetSectors), ("OBJECTIVE", AssetObjectives)),
)
def test__current_total_invested_report(client, group_by, choices_class):
    # GIVEN
    if group_by == "SECTOR":
        field = "metadata__sector"
    else:
        field = group_by.lower()
    totals = {
        v: sum(
            get_current_total_invested_brute_force(Asset.objects.get(pk=asset.write_model_pk))
            for asset in AssetReadModel.objects.filter(**{field: v})
        )
        for v in choices_class.values
    }

    # WHEN
    response = client.get(
        f"{URL}/total_invested_report?percentage=false&current=true&group_by={group_by}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    for result in response.json():
        for choice, label in choices_class.choices:
            if label == result[group_by.lower()]:
                assert convert_and_quantitize(totals[choice]) == result["total"]


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
@pytest.mark.parametrize(
    "group_by, choices_class",
    (("TYPE", AssetTypes), ("SECTOR", AssetSectors), ("OBJECTIVE", AssetObjectives)),
)
def test__current_total_invested_report__percentage(client, group_by, choices_class):
    # GIVEN
    current_total = sum(
        get_current_total_invested_brute_force(asset) for asset in Asset.objects.all()
    )
    if group_by == "SECTOR":
        field = "metadata__sector"
    else:
        field = group_by.lower()
    totals = {
        v: sum(
            get_current_total_invested_brute_force(Asset.objects.get(pk=asset.write_model_pk))
            for asset in AssetReadModel.objects.filter(**{field: v})
        )
        for v in choices_class.values
    }

    # WHEN
    response = client.get(
        f"{URL}/total_invested_report?percentage=true&current=true&group_by={group_by}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK
    for result in response.json():
        for choice, label in choices_class.choices:
            if label == result[group_by.lower()]:
                assert (
                    float(
                        convert_to_percentage_and_quantitize(
                            value=totals[choice], total=current_total
                        )
                    )
                    == result["total"]
                )


def test__total_invested_report__should_fail_wo_required_filters(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/total_invested_report")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "percentage": ["Required to define the type of report"],
        "current": ["Required to define the type of report"],
        "group_by": ["This field is required."],
    }


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
def test__roi_report__opened(client):
    # GIVEN
    totals = {
        v: sum(get_roi_brute_force(asset) for asset in Asset.objects.opened().filter(type=v))
        for v in AssetTypes.values
    }

    # WHEN
    response = client.get(f"{URL}/roi_report?opened=true&finished=false")

    # THEN
    assert response.status_code == HTTP_200_OK
    for result in response.json():
        for choice, label in AssetTypes.choices:
            if label == result["type"]:
                assert convert_and_quantitize(totals[choice]) == result["total"]


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
def test__roi_report__finished(client):
    # GIVEN
    totals = {
        v: sum(get_roi_brute_force(asset) for asset in Asset.objects.finished().filter(type=v))
        for v in AssetTypes.values
    }

    # WHEN
    response = client.get(f"{URL}/roi_report?opened=false&finished=true")

    # THEN
    assert response.status_code == HTTP_200_OK
    for result in response.json():
        for choice, label in AssetTypes.choices:
            if label == result["type"]:
                assert totals[choice] == result["total"]


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
def test__roi_report__all(client):
    # GIVEN
    totals = {
        v: sum(get_roi_brute_force(asset) for asset in Asset.objects.filter(type=v))
        for v in AssetTypes.values
    }

    # WHEN
    response = client.get(f"{URL}/roi_report?opened=true&finished=true")

    # THEN
    assert response.status_code == HTTP_200_OK
    for result in response.json():
        for choice, label in AssetTypes.choices:
            if label == result["type"]:
                assert convert_and_quantitize(totals[choice]) == result["total"]


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
def test__roi_report__none(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/roi_report?opened=false&finished=false")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == []


def test__roi_report__should_fail_wo_required_filters(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/roi_report")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "opened": ["Required to define the type of assets of the report"],
        "finished": ["Required to define the type of assets of the report"],
    }


@pytest.mark.parametrize(
    "user_fixture_name, client_fixture_name, tasks_to_run",
    (
        ("user_with_kucoin_integration", "kucoin_client", ("sync_kucoin_transactions_task",)),
        ("user_with_binance_integration", "binance_client", ("sync_binance_transactions_task",)),
    ),
)
def test_should_sync_all(request, user_fixture_name, client_fixture_name, tasks_to_run, mocker):
    # GIVEN
    path = "variable_income_assets.views.{}"
    client = request.getfixturevalue(client_fixture_name)
    user = request.getfixturevalue(user_fixture_name)

    mocked_tasks = []
    for task_name in tasks_to_run:
        m = mocker.patch(path.format(task_name))
        m.__name__ = task_name
        mocked_tasks.append(m)

    # WHEN
    response = client.get(f"{URL}/sync_all")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert all(task_name in response.json() for task_name in tasks_to_run)
    for task_name, mocked_task in zip(tasks_to_run, mocked_tasks):
        assert mocked_task.call_args[1]["username"] == user.username


@pytest.mark.usefixtures("transactions")
def test_should_simulate_transaction_w_quantity(client, stock_asset, stock_asset_metadata):
    # GIVEN
    stock_asset_metadata.current_price = 100
    stock_asset_metadata.save()

    # WHEN
    response = client.post(
        f"{URL}/{stock_asset.code}/transactions/simulate", data={"price": 50, "quantity": 100}
    )
    response_json = response.json()

    # THEN
    assert response.status_code == 200

    assert response_json["old"]["adjusted_avg_price"] < response_json["new"]["adjusted_avg_price"]
    assert response_json["old"]["roi"] < response_json["new"]["roi"]
    assert response_json["old"]["roi_percentage"] > response_json["new"]["roi_percentage"]
    assert response_json["old"]["adjusted_avg_price"] < response_json["new"]["adjusted_avg_price"]


@pytest.mark.usefixtures("transactions")
def test_should_simulate_transaction_w_total(client, stock_asset, stock_asset_metadata):
    # GIVEN
    stock_asset_metadata.current_price = 100
    stock_asset_metadata.save()

    # WHEN
    response = client.post(
        f"{URL}/{stock_asset.code}/transactions/simulate", data={"price": 50, "total": 5000}
    )
    response_json = response.json()

    # THEN
    assert response.status_code == 200

    assert response_json["old"]["adjusted_avg_price"] < response_json["new"]["adjusted_avg_price"]
    assert response_json["old"]["roi"] < response_json["new"]["roi"]
    assert response_json["old"]["roi_percentage"] > response_json["new"]["roi_percentage"]
    assert response_json["old"]["adjusted_avg_price"] < response_json["new"]["adjusted_avg_price"]


def test_should_not_simulate_transaction_wo_total_and_quantity(client, stock_asset):
    # GIVEN

    # WHEN
    response = client.post(f"{URL}/{stock_asset.code}/transactions/simulate", data={"price": 50})

    # THEN
    assert response.status_code == 400
    assert response.json() == {"non_field_errors": ["`quantity` or `total` is required"]}


@pytest.mark.usefixtures("crypto_transaction")
def test_should_not_normalize_avg_price_with_currency_when_simulating_transaction(
    client, crypto_asset
):
    # GIVEN
    price, quantity = 10, 100
    crypto_asset.current_price = 20
    crypto_asset.save()

    # WHEN
    response = client.post(
        f"{URL}/{crypto_asset.code}/transactions/simulate",
        data={"price": price, "quantity": quantity},
    )
    response_json = response.json()

    # THEN
    assert response.status_code == 200

    assert (
        response_json["old"]["adjusted_avg_price"]
        == response_json["new"]["adjusted_avg_price"]
        == price
    )


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
def test__codes_and_currencies_endpoint(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/codes_and_currencies")

    # THEN
    assert response.status_code == 200
    assert response.json() == list(
        AssetReadModel.objects.values("code", "currency").order_by("code")
    )


@pytest.mark.usefixtures(
    "transactions", "passive_incomes", "stock_asset_metadata", "sync_assets_read_model"
)
def test__delete(client, stock_asset):
    # GIVEN

    # WHEN
    response = client.delete(f"{URL}/{stock_asset.code}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT
    assert (
        Asset.objects.count()
        == Transaction.objects.count()
        == PassiveIncome.objects.count()
        == AssetReadModel.objects.count()
        == 0
    )
