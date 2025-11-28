import pytest
from config.settings.base import BASE_API_URL
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED, HTTP_204_NO_CONTENT

from django.template.defaultfilters import slugify

from ...choices import AssetObjectives, AssetSectors, AssetTypes, Currencies, TransactionActions
from ...models import Asset, AssetMetaData, AssetReadModel, Transaction

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets"


def test__create__fixed__held_custody__e2e(client, user):
    # GIVEN
    asset_data = {
        "type": AssetTypes.fixed_br,
        "objective": AssetObjectives.dividend,
        "currency": Currencies.real,
        "description": "CDB Inter liquidez diária",
        "is_held_in_self_custody": True,
    }
    transactions_data = {
        "action": TransactionActions.buy,
        "price": 10_000,
        "quantity": None,
        "operation_date": "12/12/2022",
    }

    # WHEN
    response_create_asset = client.post(f"/{BASE_API_URL}" + "assets", data=asset_data)
    asset_pk = response_create_asset.json()["id"]

    response_transaction = client.post(
        f"/{BASE_API_URL}" + "transactions", data={**transactions_data, "asset_pk": asset_pk}
    )
    response_update_price = client.patch(
        f"/{BASE_API_URL}" + f"assets/{asset_pk}/update_price",
        data={"current_price": transactions_data["price"]},
    )

    response_list = client.get(f"/{BASE_API_URL}" + "assets")

    # THEN
    assert response_create_asset.status_code == HTTP_201_CREATED
    assert response_transaction.status_code == HTTP_201_CREATED
    assert response_update_price.status_code == HTTP_204_NO_CONTENT
    assert response_list.status_code == HTTP_200_OK

    assert Asset.objects.filter(
        code=slugify(asset_data["description"]),
        type=asset_data["type"],
        currency=asset_data["currency"],
        description=asset_data["description"],
        metadata__isnull=False,
        user=user,
    ).exists()

    assert (
        AssetReadModel.objects.filter(
            code=slugify(asset_data["description"]),
            type=asset_data["type"],
            objective=asset_data["objective"],
            currency=asset_data["currency"],
            quantity_balance=1,
            avg_price=transactions_data["price"],
            normalized_avg_price=transactions_data["price"],
            normalized_total_bought=transactions_data["price"],
            normalized_total_sold=0,
            normalized_closed_roi=0,
            normalized_credited_incomes=0,
            credited_incomes=0,
            metadata__isnull=False,
            user_id=user.pk,
        ).count()
        == 1
    )
    assert (
        AssetMetaData.objects.filter(
            code=slugify(asset_data["description"]),
            type=asset_data["type"],
            sector=AssetSectors.finance,
            current_price_updated_at__isnull=False,
            current_price=transactions_data["price"],
            asset__user=user,
        ).count()
        == 1
    )
    assert Transaction.objects.filter(
        asset__code=slugify(asset_data["description"]),
        asset__type=asset_data["type"],
        asset__currency=asset_data["currency"],
        quantity__isnull=True,
        price=transactions_data["price"],
        action=TransactionActions.buy,
    )


def test__create__fixed__held_custody__another_user__e2e(
    another_client, another_user, fixed_asset_held_in_self_custody
):
    # GIVEN
    asset_data = {
        "type": fixed_asset_held_in_self_custody.type,
        "objective": AssetObjectives.dividend,
        "currency": fixed_asset_held_in_self_custody.currency,
        "description": fixed_asset_held_in_self_custody.description,
        "is_held_in_self_custody": True,
    }
    transactions_data = {
        "action": TransactionActions.buy,
        "price": 10_000,
        "quantity": None,
        "operation_date": "12/12/2022",
    }

    # WHEN
    response = another_client.post(f"/{BASE_API_URL}" + "assets", data=asset_data)
    asset_pk = response.json()["id"]

    another_client.post(
        f"/{BASE_API_URL}" + "transactions", data={**transactions_data, "asset_pk": asset_pk}
    )
    another_client.patch(
        f"/{BASE_API_URL}" + f"assets/{asset_pk}/update_price",
        data={"current_price": transactions_data["price"]},
    )

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Asset.objects.filter(
        code=slugify(asset_data["description"]),
        type=asset_data["type"],
        currency=asset_data["currency"],
        description=asset_data["description"],
        metadata__isnull=False,
        user=another_user,
    ).exists()

    assert (
        AssetReadModel.objects.filter(
            code=slugify(asset_data["description"]),
            type=asset_data["type"],
            objective=asset_data["objective"],
            currency=asset_data["currency"],
            quantity_balance=1,
            avg_price=transactions_data["price"],
            normalized_avg_price=transactions_data["price"],
            normalized_total_bought=transactions_data["price"],
            normalized_total_sold=0,
            normalized_closed_roi=0,
            normalized_credited_incomes=0,
            credited_incomes=0,
            metadata__isnull=False,
            user_id=another_user.pk,
        ).count()
        == 1
    )
    assert (
        AssetMetaData.objects.filter(
            code=slugify(asset_data["description"]),
            type=asset_data["type"],
            sector=AssetSectors.finance,
            current_price_updated_at__isnull=False,
            current_price=transactions_data["price"],
            asset__user=another_user,
        ).count()
        == 1
    )
    assert Transaction.objects.filter(
        asset__code=slugify(asset_data["description"]),
        asset__type=asset_data["type"],
        asset__currency=asset_data["currency"],
        quantity__isnull=True,
        price=transactions_data["price"],
        action=TransactionActions.buy,
    )
