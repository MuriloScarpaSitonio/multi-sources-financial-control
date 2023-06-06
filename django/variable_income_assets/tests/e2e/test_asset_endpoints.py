from decimal import ROUND_HALF_UP, Decimal
import operator

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
    user_without_assets_price_integration,
)
from config.settings.base import BASE_API_URL

from variable_income_assets.tests.shared import (
    convert_and_quantitize,
    convert_to_percentage_and_quantitize,
    get_adjusted_avg_price_brute_forte,
    get_adjusted_quantity_brute_force,
    get_avg_price_bute_force,
    get_current_price,
    get_current_total_invested_brute_force,
    get_roi_brute_force,
    get_total_bought_brute_force,
    get_total_invested_brute_force,
)
from variable_income_assets.choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    TransactionActions,
    TransactionCurrencies,
)
from variable_income_assets.models import Asset, AssetReadModel, PassiveIncome, Transaction


pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets"


def test__create(client):
    # GIVEN
    data = {
        "type": AssetTypes.fii,
        "sector": AssetSectors.utilities,
        "objective": AssetObjectives.dividend,
        "code": "IGR",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["current_price_updated_at"] is None
    assert AssetReadModel.objects.count() == 1


def test__create__same_code(client, stock_asset):
    # GIVEN
    data = {
        "type": AssetTypes.fii,
        "sector": AssetSectors.utilities,
        "objective": AssetObjectives.dividend,
        "code": stock_asset.code,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"code": ["Asset with given code already exists"]}


def test__create__w_current_price(client):
    # GIVEN
    data = {
        "type": AssetTypes.fii,
        "sector": AssetSectors.utilities,
        "objective": AssetObjectives.dividend,
        "code": "IGR",
        "current_price": "10.25",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["current_price_updated_at"] is not None


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


@pytest.mark.usefixtures("sync_assets_read_model")
def test__update(client, stock_asset):
    # GIVEN
    data = {
        "type": stock_asset.type,
        "sector": stock_asset.sector,
        "objective": AssetObjectives.growth,
        "code": stock_asset.code,
    }

    # WHEN
    response = client.put(f"{URL}/{stock_asset.code}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    stock_asset.refresh_from_db()
    assert stock_asset.current_price_updated_at is None
    assert stock_asset.objective == AssetObjectives.growth
    assert (
        AssetReadModel.objects.get(write_model_pk=stock_asset.pk).objective
        == AssetObjectives.growth
    )


@pytest.mark.usefixtures("sync_assets_read_model")
def test__update__w_current_price(client, stock_asset):
    # GIVEN
    data = {
        "type": stock_asset.type,
        "sector": stock_asset.sector,
        "objective": AssetObjectives.growth,
        "code": stock_asset.code,
        "current_price": 11,
    }

    # WHEN
    response = client.put(f"{URL}/{stock_asset.code}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["current_price_updated_at"] is not None
    assert (
        AssetReadModel.objects.get(write_model_pk=stock_asset.pk).current_price_updated_at
        is not None
    )


def test__update__asset_does_not_belong_to_user(kucoin_client, stock_asset):
    # GIVEN
    data = {
        "type": stock_asset.type,
        "sector": stock_asset.sector,
        "objective": AssetObjectives.growth,
        "code": stock_asset.code,
        "current_price": 11,
    }

    # WHEN
    response = kucoin_client.put(f"{URL}/{stock_asset.code}", data=data)

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Not found."}


@pytest.mark.usefixtures("transactions", "passive_incomes", "sync_assets_read_model")
@pytest.mark.parametrize(
    "filter_by, count",
    (
        ("", 1),
        ("code=ALUP", 1),
        # ("ROI_type=PROFIT", 1),
        # ("ROI_type=LOSS", 0),
        ("type=STOCK", 1),
        ("type=STOCK_USA", 0),
    ),
)
def test_should_filter_assets(client, filter_by, count):
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
def test_should_list_assets(client, stock_asset, fixture, operation, request):
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
        qty = get_adjusted_quantity_brute_force(asset=asset)
        total_invested = get_avg_price_bute_force(asset=asset, normalize=True) * qty
        percentage_invested = (
            (total_invested / total_invested_brute_force) * Decimal("100.0")
        ).quantize(Decimal(".1"), rounding=ROUND_HALF_UP)

        current_invested = get_current_price(asset, normalize=True) * qty
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
    client, stock_usa_asset, crypto_asset, another_stock_asset, fii_asset, sync_assets_read_model
):
    # GIVEN
    expected = {
        stock_usa_asset.code: TransactionCurrencies.dollar,
        crypto_asset.code: TransactionCurrencies.real,
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


@pytest.mark.usefixtures("assets", "transactions", "sync_assets_read_model")
def test_should_call_fetch_current_assets_prices_task(client, user, stock_usa_asset, mocker):
    # GIVEN
    mocked_task = mocker.patch("variable_income_assets.views.fetch_current_assets_prices")
    Transaction.objects.create(
        action=TransactionActions.buy, price=50, asset=stock_usa_asset, quantity=100
    )

    # WHEN
    response = client.get(f"{URL}/fetch_current_prices?code=ALUP11&code=URA")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["username"] == user.username
    assert mocked_task.call_args[1]["codes"] == ["ALUP11", "URA"]


def test_should_raise_permission_error_fetch_current_prices_if_user_has_not_set_credentials(
    binance_client,
):
    # GIVEN

    # WHEN
    response = binance_client.get(f"{URL}/fetch_current_prices")

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {
        "detail": "User has not set the given credentials for Assets Prices integration"
    }


@pytest.mark.usefixtures(
    "transactions", "another_stock_asset_transactions", "sync_assets_read_model"
)
def test_should_raise_error_if_asset_is_finished_fetch_current_assets_prices(
    client, stock_asset, another_stock_asset
):
    # GIVEN

    # WHEN
    response = client.get(
        f"{URL}/fetch_current_prices?code={stock_asset.code}&code={another_stock_asset.code}"
    )

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "code": [
            f"Select a valid choice. {another_stock_asset.code} is not one of the available choices."
        ]
    }


@pytest.mark.usefixtures("assets")
def test_should_raise_error_if_code_is_not_valid_fetch_current_prices(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/fetch_current_prices?code=ALSO3")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "code": ["Select a valid choice. ALSO3 is not one of the available choices."]
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
    totals = {
        v: sum(
            get_total_invested_brute_force(asset)
            for asset in Asset.objects.filter(**{group_by.lower(): v})
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
    totals = {
        v: sum(
            get_total_invested_brute_force(asset)
            for asset in Asset.objects.filter(**{group_by.lower(): v})
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
    totals = {
        v: sum(
            get_current_total_invested_brute_force(asset)
            for asset in Asset.objects.filter(**{group_by.lower(): v})
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
    totals = {
        v: sum(
            get_current_total_invested_brute_force(asset)
            for asset in Asset.objects.filter(**{group_by.lower(): v})
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
        (
            "user",
            "client",
            (
                # "sync_cei_transactions_task",
                # "sync_cei_passive_incomes_task",
                "fetch_current_assets_prices",
            ),
        ),
        (
            "user_without_assets_price_integration",
            "client",
            (
                # "sync_cei_transactions_task",
                # "sync_cei_passive_incomes_task",
            ),
        ),
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
        extra_kwargs = (
            {"codes": list(Asset.objects.filter(user=user).opened().values_list("code", flat=True))}
            if task_name == "fetch_current_assets_prices"
            else {}
        )

        assert mocked_task.call_args[1]["username"] == user.username
        for k, v in extra_kwargs.items():
            mocked_task.call_args[1][k] == v


@pytest.mark.usefixtures("transactions")
def test_should_simulate_transaction_w_quantity(client, stock_asset):
    # GIVEN
    stock_asset.current_price = 100
    stock_asset.save()

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
def test_should_simulate_transaction_w_total(client, stock_asset):
    # GIVEN
    stock_asset.current_price = 100
    stock_asset.save()

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


@pytest.mark.usefixtures("transactions", "passive_incomes", "sync_assets_read_model")
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
