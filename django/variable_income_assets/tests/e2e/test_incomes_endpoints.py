from datetime import datetime
from statistics import fmean

from django.db.models import Q
from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
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

from ...choices import (
    AssetTypes,
    Currencies,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
)
from ...models import Asset, PassiveIncome
from ...models.managers import PassiveIncomeQuerySet
from ..shared import get_total_credited_incomes_brute_force

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
    assert mocked_task.call_args.kwargs == {
        "asset_id": stock_asset.pk,
        "is_aggregate_upsert": True,
        "is_held_in_self_custody": False,
    }

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
    assert mocked_task.call_args.kwargs == {
        "asset_id": stock_usa_asset.pk,
        "is_aggregate_upsert": True,
        "is_held_in_self_custody": False,
    }

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
            "Esta propriedade não pode ser omitida ou ter valor igual a 1 se a "
            f"moeda do ativo for diferente de {Currencies.real}"
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
        "current_currency_conversion_rate": [
            "Esta propriedade precisa ser omitidata para eventos do tipo "
            + PassiveIncomeEventTypes.provisioned
        ]
    }


def test__create__credited__future(client, stock_usa_asset):
    # GIVEN
    data = {
        "type": PassiveIncomeTypes.dividend,
        "event_type": PassiveIncomeEventTypes.credited,
        "amount": 100,
        "operation_date": "06/12/2999",
        "asset_pk": stock_usa_asset.pk,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "operation_date": ["Rendimentos já creditados não podem ser criados no futuro"]
    }


def test__create__fixed_br(client, fixed_asset_held_in_self_custody):
    # GIVEN
    data = {
        "type": PassiveIncomeTypes.dividend,
        "event_type": PassiveIncomeEventTypes.credited,
        "amount": 100,
        "operation_date": "06/12/2022",
        "asset_pk": fixed_asset_held_in_self_custody.pk,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"type": ["Ativos de classe Renda fixa BR não aceitam rendimentos"]}


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
    assert mocked_task.call_args.kwargs == {
        "asset_id": simple_income.asset_id,
        "is_aggregate_upsert": True,
        "is_held_in_self_custody": False,
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
    assert mocked_task.call_args.kwargs == {
        "asset_id": simple_income.asset_id,
        "is_aggregate_upsert": True,
        "is_held_in_self_custody": False,
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
            "Esta propriedade não pode ser omitida ou ter valor igual a 1 se a "
            f"moeda do ativo for diferente de {Currencies.real}"
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
        "current_currency_conversion_rate": [
            "Esta propriedade precisa ser omitidata para eventos do tipo "
            + PassiveIncomeEventTypes.provisioned
        ]
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


def test__update__credited__future(client, another_income):
    # GIVEN
    data = {
        "type": another_income.type,
        "event_type": another_income.event_type,
        "amount": another_income.amount,
        "operation_date": "06/12/2999",
    }

    # WHEN
    response = client.put(f"{URL}/{another_income.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "operation_date": ["Rendimentos já creditados não podem ser criados no futuro"]
    }


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
                    "id": simple_income.asset.pk,
                    "code": simple_income.asset.code,
                    "type": AssetTypes.get_choice(simple_income.asset.type).label,
                    "currency": simple_income.asset.currency,
                    "description": simple_income.asset.description,
                    "is_held_in_self_custody": simple_income.asset.is_held_in_self_custody,
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
    assert mocked_task.call_args.kwargs == {
        "asset_id": simple_income.asset_id,
        "is_aggregate_upsert": True,
        "is_held_in_self_custody": False,
    }

    assert response.status_code == HTTP_204_NO_CONTENT
    assert not PassiveIncome.objects.exists()


@pytest.mark.usefixtures("passive_incomes", "stock_usa_asset", "crypto_asset")
def test__avg(client, user):
    # GIVEN
    today = timezone.now().date()
    qs = (
        PassiveIncome.objects.filter(asset__user_id=user.id)
        .since_a_year_ago()
        .exclude(operation_date__month=today.month, operation_date__year=today.year)
        .credited()
    )

    # WHEN
    response = client.get(f"{URL}/avg")

    # THEN
    assert response.status_code == 200
    assert response.json() == {
        "avg": convert_and_quantitize(
            fmean([p.amount * p.current_currency_conversion_rate for p in qs])
        )
    }


@pytest.mark.usefixtures("passive_incomes")
def test__sum_credited(client, user):
    # GIVEN
    today = timezone.localdate()
    start_date, end_date = today, today + relativedelta(months=1)
    qs = PassiveIncome.objects.filter(
        asset__user_id=user.id, operation_date__range=(start_date, end_date)
    ).credited()

    # WHEN
    response = client.get(
        f"{URL}/sum_credited?start_date={start_date.strftime('%d/%m/%Y')}"
        + f"&end_date={end_date.strftime('%d/%m/%Y')}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    assert response.json() == {
        "total": convert_and_quantitize(
            sum(p.amount * p.current_currency_conversion_rate for p in qs)
        )
    }


@pytest.mark.usefixtures("passive_incomes")
def test__sum_provisioned_future(client, user):
    # GIVEN
    qs = PassiveIncome.objects.filter(asset__user_id=user.id).future().provisioned()

    # WHEN
    response = client.get(f"{URL}/sum_provisioned_future")

    # THEN
    assert response.status_code == HTTP_200_OK

    assert response.json() == {
        "total": convert_and_quantitize(
            sum(p.amount * p.current_currency_conversion_rate for p in qs)
        )
    }


@pytest.mark.usefixtures("passive_incomes")
def test__historic(client, user, stock_asset):
    # GIVEN
    today = timezone.localdate().replace(day=12)

    start_date, end_date = today - relativedelta(months=18), today
    last_day_of_month = end_date + relativedelta(day=31)
    PassiveIncome.objects.create(
        operation_date=last_day_of_month,
        amount=1200,
        type=PassiveIncomeTypes.dividend,
        event_type=PassiveIncomeEventTypes.credited,
        asset=stock_asset,
    )
    PassiveIncome.objects.create(
        operation_date=last_day_of_month,
        amount=1200,
        type=PassiveIncomeTypes.dividend,
        event_type=PassiveIncomeEventTypes.provisioned,
        asset=stock_asset,
    )

    # WHEN
    response = client.get(
        f"{URL}/historic_report?start_date={start_date.strftime('%d/%m/%Y')}"
        + f"&end_date={end_date.strftime('%d/%m/%Y')}"
    )
    response_json = response.json()

    # THEN
    assert response.status_code == HTTP_200_OK

    for result in response_json["historic"]:
        d = datetime.strptime(result["month"], "%d/%m/%Y").date()
        total_credited = sum(
            p.amount * p.current_currency_conversion_rate
            for p in PassiveIncome.objects.credited().filter(
                asset__user_id=user.id,
                operation_date__month=d.month,
                operation_date__year=d.year,
            )
        )
        assert convert_and_quantitize(result["credited"]) == convert_and_quantitize(total_credited)

        total_provisioned = sum(
            p.amount * p.current_currency_conversion_rate
            for p in PassiveIncome.objects.provisioned().filter(
                asset__user_id=user.id,
                operation_date__month=d.month,
                operation_date__year=d.year,
            )
        )
        assert convert_and_quantitize(result["provisioned"]) == convert_and_quantitize(
            total_provisioned
        )

    assert convert_and_quantitize(response_json["avg"]) == convert_and_quantitize(
        fmean([h["credited"] for h in response_json["historic"]])
    )


@pytest.mark.usefixtures(
    "passive_incomes", "another_income", "assets_w_incomes", "stock_asset", "stock_usa_asset"
)
def test__assets_aggregation_report(client, user):
    # GIVEN
    today = timezone.localdate()
    start_date, end_date = today, today + relativedelta(months=1)
    qs = PassiveIncome.objects.filter(operation_date__range=(start_date, end_date))

    # WHEN
    response = client.get(
        f"{URL}/assets_aggregation_report?start_date={start_date.strftime('%d/%m/%Y')}"
        + f"&end_date={end_date.strftime('%d/%m/%Y')}"
    )

    # THEN
    for r in response.json():
        asset = Asset.objects.get(code=r["code"], user_id=user.id)
        total_credited = sum(
            p.amount * p.current_currency_conversion_rate for p in qs.credited().filter(asset=asset)
        )
        assert convert_and_quantitize(total_credited) == r["credited"]

        total_provisioned = sum(
            p.amount * p.current_currency_conversion_rate
            for p in qs.provisioned().filter(asset=asset)
        )
        assert convert_and_quantitize(total_provisioned) == r["provisioned"]


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
