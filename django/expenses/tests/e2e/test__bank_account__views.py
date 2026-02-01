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
)

from config.settings.base import BASE_API_URL
from shared.tests import convert_and_quantitize

from ...models import BankAccount

pytestmark = pytest.mark.django_db

URL = f"/{BASE_API_URL}" + "bank_accounts"


class TestPermissions:
    def test__forbidden__module_not_enabled(self, user, client):
        # GIVEN
        user.is_personal_finances_module_enabled = False
        user.save()

        # WHEN
        response = client.get(URL)

        # THEN
        assert response.status_code == HTTP_403_FORBIDDEN
        assert response.json() == {"detail": "Você não tem acesso ao módulo de finanças pessoais"}

    def test__forbidden__subscription_ended(self, client, user):
        # GIVEN
        user.subscription_ends_at = timezone.now()
        user.save()

        # WHEN
        response = client.get(URL)

        # THEN
        assert response.status_code == HTTP_403_FORBIDDEN
        assert response.json() == {"detail": "Sua assinatura expirou"}

    def test__unauthorized__inactive(self, client, user):
        # GIVEN
        user.is_active = False
        user.save()

        # WHEN
        response = client.get(URL)

        # THEN
        assert response.status_code == HTTP_401_UNAUTHORIZED


class TestList:
    def test__response_schema(self, client, bank_account):
        # GIVEN

        # WHEN
        response = client.get(URL)

        # THEN
        assert response.status_code == HTTP_200_OK
        response_json = response.json()

        assert response_json["count"] == 1
        assert response_json["next"] is None
        assert response_json["previous"] is None

        result = response_json["results"][0]
        assert result == {
            "amount": convert_and_quantitize(bank_account.amount),
            "description": bank_account.description,
            "is_active": True,
            "is_default": True,
            "credit_card_bill_day": bank_account.credit_card_bill_day,
            "updated_at": result["updated_at"],  # Accept any valid timestamp
        }

    def test__returns_multiple_accounts(self, client, bank_account, second_bank_account):
        # GIVEN

        # WHEN
        response = client.get(URL)

        # THEN
        assert response.status_code == HTTP_200_OK
        response_json = response.json()

        assert response_json["count"] == 2
        descriptions = [item["description"] for item in response_json["results"]]
        assert bank_account.description in descriptions
        assert second_bank_account.description in descriptions

    def test__returns_empty_list_when_no_accounts(self, client, user):
        # GIVEN

        # WHEN
        response = client.get(URL)

        # THEN
        assert response.status_code == HTTP_200_OK
        assert response.json()["count"] == 0
        assert response.json()["results"] == []

    def test__excludes_inactive_accounts(self, client, bank_account, second_bank_account):
        # GIVEN
        second_bank_account.is_active = False
        second_bank_account.save()

        # WHEN
        response = client.get(URL)

        # THEN
        assert response.status_code == HTTP_200_OK
        response_json = response.json()

        assert response_json["count"] == 1
        assert response_json["results"][0]["description"] == bank_account.description


class TestCreate:
    def test__creates_new_account(self, client, user):
        # GIVEN
        data = {"amount": 5000, "description": "Nubank", "is_default": True}

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_201_CREATED
        response_json = response.json()

        assert response_json["amount"] == convert_and_quantitize(5000)
        assert response_json["description"] == "Nubank"
        assert response_json["is_default"] is True
        assert response_json["is_active"] is True

        assert BankAccount.objects.filter(user=user, description="Nubank").exists()

    def test__creates_account_with_credit_card_bill_day(self, client, user):
        # GIVEN
        data = {"amount": 3000, "description": "Itaú", "credit_card_bill_day": 15}

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_201_CREATED
        response_json = response.json()

        assert response_json["credit_card_bill_day"] == 15

    def test__auto_toggles_default_on_create(self, client, bank_account):
        # GIVEN
        assert bank_account.is_default is True
        data = {"amount": 5000, "description": "Itaú", "is_default": True}

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_201_CREATED
        assert response.json()["is_default"] is True

        bank_account.refresh_from_db()
        assert bank_account.is_default is False

    def test__fails_with_duplicate_description(self, client, bank_account):
        # GIVEN
        data = {"amount": 5000, "description": bank_account.description}

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_400_BAD_REQUEST

    def test__fails_without_required_fields(self, client, user):
        # GIVEN
        data = {"amount": 5000}

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_400_BAD_REQUEST
        assert "description" in response.json()

    def test__credit_card_bill_day_validation__min(self, client, user):
        # GIVEN
        data = {"amount": 5000, "description": "Test", "credit_card_bill_day": 0}

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_400_BAD_REQUEST
        assert "credit_card_bill_day" in response.json()

    def test__credit_card_bill_day_validation__max(self, client, user):
        # GIVEN
        data = {"amount": 5000, "description": "Test", "credit_card_bill_day": 32}

        # WHEN
        response = client.post(URL, data=data)

        # THEN
        assert response.status_code == HTTP_400_BAD_REQUEST
        assert "credit_card_bill_day" in response.json()


class TestUpdate:
    def test__updates_account(self, client, bank_account):
        # GIVEN
        old_description = bank_account.description
        data = {"amount": 15000, "description": "Nubank Updated"}

        # WHEN
        response = client.put(f"{URL}/{old_description}", data=data)

        # THEN
        assert response.status_code == HTTP_200_OK

        bank_account.refresh_from_db()
        assert bank_account.amount == 15000
        assert bank_account.description == "Nubank Updated"

    def test__updates_credit_card_bill_day(self, client, bank_account):
        # GIVEN
        data = {
            "amount": bank_account.amount,
            "description": bank_account.description,
            "credit_card_bill_day": 20,
        }

        # WHEN
        response = client.put(f"{URL}/{bank_account.description}", data=data)

        # THEN
        assert response.status_code == HTTP_200_OK

        bank_account.refresh_from_db()
        assert bank_account.credit_card_bill_day == 20

    def test__auto_toggles_default_on_update(self, client, bank_account, second_bank_account):
        # GIVEN
        assert bank_account.is_default is True
        assert second_bank_account.is_default is False
        data = {
            "amount": second_bank_account.amount,
            "description": second_bank_account.description,
            "is_default": True,
        }

        # WHEN
        response = client.put(f"{URL}/{second_bank_account.description}", data=data)

        # THEN
        assert response.status_code == HTTP_200_OK
        assert response.json()["is_default"] is True

        bank_account.refresh_from_db()
        second_bank_account.refresh_from_db()
        assert bank_account.is_default is False
        assert second_bank_account.is_default is True

    def test__fails_with_duplicate_description(self, client, bank_account, second_bank_account):
        # GIVEN
        data = {
            "amount": second_bank_account.amount,
            "description": bank_account.description,  # Use first account's description
        }

        # WHEN
        response = client.put(f"{URL}/{second_bank_account.description}", data=data)

        # THEN
        assert response.status_code == HTTP_400_BAD_REQUEST


class TestDelete:
    def test__soft_deletes_account(self, client, bank_account, second_bank_account):
        # GIVEN - second_bank_account is not default, so it can be deleted

        # WHEN
        response = client.delete(f"{URL}/{second_bank_account.description}")

        # THEN
        assert response.status_code == HTTP_204_NO_CONTENT

        second_bank_account.refresh_from_db()
        assert second_bank_account.is_active is False

    def test__cannot_delete_default_account(self, client, bank_account):
        # GIVEN
        assert bank_account.is_default is True

        # WHEN
        response = client.delete(f"{URL}/{bank_account.description}")

        # THEN
        assert response.status_code == HTTP_400_BAD_REQUEST
        assert response.json() == {"detail": "Não é possível excluir a conta padrão"}

        bank_account.refresh_from_db()
        assert bank_account.is_active is True


class TestSummary:
    def test__returns_aggregate_total(self, client, bank_account, second_bank_account):
        # GIVEN
        # bank_account has 10000, second_bank_account has 5000

        # WHEN
        response = client.get(f"{URL}/summary")

        # THEN
        assert response.status_code == HTTP_200_OK
        assert response.json()["total"] == convert_and_quantitize(15000)

    def test__excludes_inactive_accounts(self, client, bank_account, second_bank_account):
        # GIVEN
        second_bank_account.is_active = False
        second_bank_account.save()

        # WHEN
        response = client.get(f"{URL}/summary")

        # THEN
        assert response.status_code == HTTP_200_OK
        assert response.json()["total"] == convert_and_quantitize(10000)

    def test__returns_zero_when_no_accounts(self, client, user):
        # GIVEN

        # WHEN
        response = client.get(f"{URL}/summary")

        # THEN
        assert response.status_code == HTTP_200_OK
        assert response.json()["total"] == convert_and_quantitize(0)


class TestHistory:
    def test__returns_history(self, client, bank_account_snapshot_factory):
        # GIVEN
        today = timezone.localdate()
        start_date, end_date = today - relativedelta(months=18), today
        bank_account_snapshot_factory(total=5000)

        # WHEN
        response = client.get(
            f"{URL}/history"
            + f"?start_date={start_date.strftime('%d/%m/%Y')}"
            + f"&end_date={end_date.strftime('%d/%m/%Y')}"
        )

        # THEN
        assert response.status_code == HTTP_200_OK

        assert all(h["total"] == 0 for h in response.json()[:-1])
        assert response.json()[-1]["total"] == 5000
