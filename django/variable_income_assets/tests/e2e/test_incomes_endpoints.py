from datetime import datetime
from decimal import Decimal

from django.db.models import Avg, Q
from django.utils import timezone

import pytest
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_404_NOT_FOUND,
)

from authentication.tests.conftest import (
    client,
    kucoin_client,
    kucoin_secrets,
    secrets,
    user,
    user_with_kucoin_integration,
)
from config.settings.base import BASE_API_URL
from variable_income_assets.choices import (
    AssetTypes,
    Currencies,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
)
from variable_income_assets.models import PassiveIncome
from variable_income_assets.tests.shared import convert_and_quantitize

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "incomes"


@pytest.mark.parametrize(
    "data",
    (
        {
            "type": PassiveIncomeTypes.dividend,
            "event_type": PassiveIncomeEventTypes.credited,
            "amount": 100,
            "operation_date": "06/12/2022",
        },
        {
            "type": PassiveIncomeTypes.dividend,
            "event_type": PassiveIncomeEventTypes.credited,
            "amount": 100,
            "operation_date": "06/12/2022",
            "current_currency_conversion_rate": 5,
        },
    ),
)
def test__create__stock(client, data, stock_asset, mocker):
    # GIVEN
    data["asset_pk"] = stock_asset.pk
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model"
    )

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert mocked_task.call_count == 1
    assert mocked_task.call_args[1] == {"asset_id": stock_asset.pk, "is_aggregate_upsert": True}

    assert response.status_code == HTTP_201_CREATED
    assert PassiveIncome.objects.filter(current_currency_conversion_rate=1).count() == 1


@pytest.mark.django_db(transaction=True)
def test__create__stock_usa(client, stock_usa_asset, mocker):
    # GIVEN
    data = {
        "type": PassiveIncomeTypes.dividend,
        "event_type": PassiveIncomeEventTypes.credited,
        "amount": 100,
        "operation_date": "06/12/2022",
        "current_currency_conversion_rate": 5,
        "asset_pk": stock_usa_asset.pk,
    }
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model"
    )

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert mocked_task.call_count == 1
    assert mocked_task.call_args[1] == {"asset_id": stock_usa_asset.pk, "is_aggregate_upsert": True}

    assert response.status_code == HTTP_201_CREATED


@pytest.mark.parametrize(
    "data",
    (
        {
            "type": PassiveIncomeTypes.dividend,
            "event_type": PassiveIncomeEventTypes.credited,
            "amount": 100,
            "operation_date": "06/12/2022",
        },
        {
            "type": PassiveIncomeTypes.dividend,
            "event_type": PassiveIncomeEventTypes.credited,
            "amount": 100,
            "operation_date": "06/12/2022",
            "current_currency_conversion_rate": 1,
        },
    ),
)
def test__create__stock_usa__current_currency_conversion_rate(client, data, stock_usa_asset):
    # GIVEN
    data["asset_pk"] = stock_usa_asset.pk

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "current_currency_conversion_rate": [
            "This value can't be ommited or set to 1 if the asset's currency is different than BRL"
        ]
    }


@pytest.mark.parametrize(
    "data",
    (
        {
            "type": PassiveIncomeTypes.dividend,
            "event_type": PassiveIncomeEventTypes.credited,
            "amount": 100,
            "operation_date": "06/12/2022",
            "asset_pk": 21849769826497816,
        },
        {
            "type": PassiveIncomeTypes.dividend,
            "event_type": PassiveIncomeEventTypes.credited,
            "amount": 100,
            "operation_date": "06/12/2022",
        },
    ),
)
def test__create__asset_not_found(client, data):
    # GIVEN

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND
    assert response.json() == {"asset": "Not found."}


def test__create__provisioned__w_rate(client, stock_usa_asset):
    # GIVEN
    data = {
        "type": PassiveIncomeTypes.dividend,
        "event_type": PassiveIncomeEventTypes.provisioned,
        "amount": 100,
        "operation_date": "06/12/2024",
        "current_currency_conversion_rate": 5,
        "asset_pk": stock_usa_asset.pk,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "current_currency_conversion_rate": ["This value must be ommited for PROVISIONED events"]
    }


@pytest.mark.django_db(transaction=True)
def test__update(client, simple_income, mocker):
    # GIVEN
    data = {
        "type": simple_income.type,
        "event_type": simple_income.event_type,
        "amount": simple_income.amount + 1,
        "operation_date": simple_income.operation_date.strftime("%d/%m/%Y"),
    }
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model"
    )

    # WHEN
    response = client.put(f"{URL}/{simple_income.pk}", data=data)

    # THEN
    assert mocked_task.call_count == 1
    assert mocked_task.call_args[1] == {
        "asset_id": simple_income.asset_id,
        "is_aggregate_upsert": True,
    }

    assert response.status_code == HTTP_200_OK


def test__update__w_asset_pk(client, simple_income, mocker):
    # GIVEN
    data = {
        "type": simple_income.type,
        "event_type": simple_income.event_type,
        "amount": simple_income.amount + 1,
        "operation_date": simple_income.operation_date.strftime("%d/%m/%Y"),
        "asset_pk": simple_income.asset_id,
    }
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model"
    )

    # WHEN
    response = client.put(f"{URL}/{simple_income.pk}", data=data)

    # THEN
    assert mocked_task.call_count == 1
    assert mocked_task.call_args[1] == {
        "asset_id": simple_income.asset_id,
        "is_aggregate_upsert": True,
    }

    assert response.status_code == HTTP_200_OK


@pytest.mark.parametrize("extra_data", ({}, {"current_currency_conversion_rate": 5}))
def test__update__stock(client, extra_data, simple_income, mocker):
    # GIVEN
    data = {
        "type": simple_income.type,
        "event_type": PassiveIncomeEventTypes.credited,
        "amount": simple_income.amount * 2,
        "operation_date": simple_income.operation_date.strftime("%d/%m/%Y"),
        **extra_data,
    }
    mocker.patch("variable_income_assets.service_layer.handlers.upsert_asset_read_model")

    # WHEN
    response = client.put(f"{URL}/{simple_income.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    assert (
        PassiveIncome.objects.filter(
            current_currency_conversion_rate=1, amount=simple_income.amount * 2
        ).count()
        == 1
    )


def test__update__stock_usa(client, another_income, mocker):
    # GIVEN
    data = {
        "type": another_income.type,
        "event_type": PassiveIncomeEventTypes.credited,
        "amount": another_income.amount * 2,
        "operation_date": another_income.operation_date.strftime("%d/%m/%Y"),
        "current_currency_conversion_rate": 2.22,
    }
    mocker.patch("variable_income_assets.service_layer.handlers.upsert_asset_read_model")

    # WHEN
    response = client.put(f"{URL}/{another_income.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    assert (
        PassiveIncome.objects.filter(
            current_currency_conversion_rate=2.22,
            amount=another_income.amount * 2,
        ).count()
        == 1
    )


@pytest.mark.parametrize("extra_data", ({}, {"current_currency_conversion_rate": 1}))
def test__create__stock_usa__current_currency_conversion_rate(client, extra_data, another_income):
    # GIVEN
    data = {
        "type": another_income.type,
        "event_type": PassiveIncomeEventTypes.credited,
        "amount": another_income.amount * 2,
        "operation_date": another_income.operation_date.strftime("%d/%m/%Y"),
        **extra_data,
    }

    # WHEN
    response = client.put(f"{URL}/{another_income.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "current_currency_conversion_rate": [
            "This value can't be ommited or set to 1 if the asset's currency is different than BRL"
        ]
    }


def test__update__provisioned__w_rate(client, another_income):
    # GIVEN
    data = {
        "type": another_income.type,
        "event_type": PassiveIncomeEventTypes.provisioned,
        "amount": another_income.amount,
        "operation_date": another_income.operation_date.strftime("%d/%m/%Y"),
        "current_currency_conversion_rate": 5,
    }

    # WHEN
    response = client.put(f"{URL}/{another_income.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "current_currency_conversion_rate": ["This value must be ommited for PROVISIONED events"]
    }


def test__update__provisioned__wo_rate(client, another_income, mocker):
    # GIVEN
    data = {
        "type": another_income.type,
        "event_type": PassiveIncomeEventTypes.provisioned,
        "amount": another_income.amount,
        "operation_date": another_income.operation_date.strftime("%d/%m/%Y"),
    }
    mocker.patch("variable_income_assets.service_layer.handlers.upsert_asset_read_model")

    # WHEN
    response = client.put(f"{URL}/{another_income.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK


def test__list__sanity_check(client, simple_income):
    # GIVEN

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": simple_income.pk,
                "type": PassiveIncomeTypes.get_choice(simple_income.type).label,
                "event_type": PassiveIncomeEventTypes.get_choice(simple_income.event_type).label,
                "operation_date": simple_income.operation_date.strftime("%Y-%m-%d"),
                "amount": simple_income.amount,
                "current_currency_conversion_rate": simple_income.current_currency_conversion_rate,
                "asset": {
                    "pk": simple_income.asset.pk,
                    "code": simple_income.asset.code,
                    "type": AssetTypes.get_choice(simple_income.asset.type).label,
                    "currency": Currencies.get_choice(simple_income.asset.currency).label,
                },
            }
        ],
    }


@pytest.mark.usefixtures("stock_asset")
def test__update__income_does_not_belong_to_user(kucoin_client, simple_income):
    # GIVEN
    data = {
        "type": simple_income.type,
        "event_type": simple_income.event_type,
        "amount": simple_income.amount + 1,
        "operation_date": simple_income.operation_date.strftime("%d/%m/%Y"),
        "asset_pk": simple_income.asset_id,
    }

    # WHEN
    response = kucoin_client.put(f"{URL}/{simple_income.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Not found."}


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("stock_asset")
def test__delete(client, simple_income, mocker):
    # GIVEN
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model"
    )

    # WHEN
    response = client.delete(f"{URL}/{simple_income.pk}")

    # THEN
    assert mocked_task.call_count == 1
    assert mocked_task.call_args[1] == {
        "asset_id": simple_income.asset_id,
        "is_aggregate_upsert": True,
    }

    assert response.status_code == HTTP_204_NO_CONTENT
    assert not PassiveIncome.objects.exists()


@pytest.mark.usefixtures("passive_incomes", "stock_usa_asset", "crypto_asset")
def test__indicators(client):
    # GIVEN
    today = timezone.now().date()
    current_credited = sum(
        i.amount
        for i in PassiveIncome.objects.filter(
            operation_date__month=today.month, operation_date__year=today.year
        ).credited()
    )
    provisioned_future = sum(
        i.amount
        for i in PassiveIncome.objects.filter(
            Q(operation_date__month__gte=today.month, operation_date__year=today.year)
            | Q(operation_date__year__gt=today.year)
        ).provisioned()
    )
    avg = (
        PassiveIncome.objects.filter(
            Q(operation_date__month__gte=today.month, operation_date__year=today.year - 1)
            | Q(operation_date__month__lte=today.month, operation_date__year=today.year)
        )
        .exclude(operation_date__month=today.month, operation_date__year=today.year)
        .credited()
        .trunc_months()
        .aggregate(avg=Avg("total"))["avg"]
    )

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    assert response.status_code == 200
    assert response.json() == {
        "avg": convert_and_quantitize(avg),
        "current_credited": convert_and_quantitize(current_credited),
        "provisioned_future": convert_and_quantitize(provisioned_future),
        "diff_percentage": convert_and_quantitize(
            ((current_credited / avg) - Decimal("1.0")) * Decimal("100.0")
        ),
    }


@pytest.mark.usefixtures("passive_incomes")
def test__historic(client):
    # GIVEN
    today = timezone.now().date()

    # WHEN
    response = client.get(f"{URL}/historic")
    response_json = response.json()

    # THEN
    assert response.status_code == HTTP_200_OK

    for result in response_json["historic"]:
        d = datetime.strptime(result["month"], "%d/%m/%Y").date()
        assert result["total"] == convert_and_quantitize(
            PassiveIncome.objects.filter(
                operation_date__month=d.month, operation_date__year=d.year
            ).sum()["total"]
        )
        if d == today.replace(day=1):  # we don't evaluate the current month on the avg calculation
            continue


@pytest.mark.usefixtures(
    "passive_incomes", "another_income", "assets_w_incomes", "stock_asset", "stock_usa_asset"
)
@pytest.mark.parametrize("filters", ("credited=True", "credited=True&all=true"))
def test__assets_aggregation_report(client, filters, django_assert_num_queries):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/assets_aggregation_report?{filters}")

    # THEN
    if "all" in filters:
        assert len(response.json()) == 10
    else:
        assert len(response.json()) == 9

    for r in response.json():
        qs = PassiveIncome.objects.credited().filter(asset__code=r["code"])
        if "all" not in filters:
            qs = qs.since_a_year_ago()

        assert convert_and_quantitize(qs.sum()["total"]) == r["total"]
