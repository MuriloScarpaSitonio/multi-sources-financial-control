import operator
from datetime import date

from django.db.models import Q
from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
)

from config.settings.base import BASE_API_URL

from ...choices import CREDIT_CARD_SOURCE
from ...models import Expense, ExpenseTag

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "expenses"


def test__create__is_fixed(client, bank_account):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2021",
        "source": CREDIT_CARD_SOURCE,
        "installments": None,
        "is_fixed": True,
    }
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.post(f"{URL}?perform_actions_on_future_fixed_entities=true", data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.filter(
            recurring_id__isnull=False,
            value=12,
            description="Test",
            category="Casa",
            source=CREDIT_CARD_SOURCE,
            is_fixed=True,
        ).count()
        == 12
    )
    assert Expense.objects.only("created_at").latest("created_at").created_at == date(
        year=2021, month=12, day=1
    )


def test__create__installments__none__is_fixed(client):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2021",
        "source": CREDIT_CARD_SOURCE,
        "installments": None,
        "is_fixed": True,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Expense.objects.count() == 1


def test__create__installments__gt_1__is_fixed(client):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2021",
        "source": CREDIT_CARD_SOURCE,
        "installments": 2,
        "is_fixed": True,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"installments": "Despesas fixas não podem ser parceladas"}


def test__create__is_fixed__tags(client, bank_account):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2021",
        "source": CREDIT_CARD_SOURCE,
        "installments": None,
        "is_fixed": True,
        "tags": ["a", "b", "c"],
    }
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.post(f"{URL}?perform_actions_on_future_fixed_entities=true", data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    qs = Expense.objects.filter(
        recurring_id__isnull=False,
        value=12,
        description="Test",
        category="Casa",
        source=CREDIT_CARD_SOURCE,
        is_fixed=True,
    )
    assert qs.count() == 12
    assert Expense.objects.only("created_at").latest("created_at").created_at == date(
        year=2021, month=12, day=1
    )

    for expense in qs:
        assert list(expense.tags.values_list("name", flat=True).order_by("name")) == data["tags"]


def test__create__is_fixed__tags__reuse(client, user, bank_account, expense_w_tags):
    # GIVEN
    existing_tags = list(expense_w_tags.tags.all())
    tags = [t.name for t in existing_tags] + ["def"]

    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2021",
        "source": CREDIT_CARD_SOURCE,
        "installments": None,
        "is_fixed": True,
        "tags": tags,
    }
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.post(f"{URL}?perform_actions_on_future_fixed_entities=true", data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        list(ExpenseTag.objects.filter(user=user).values_list("name", flat=True).order_by("name"))
        == tags
    )

    assert list(expense_w_tags.tags.all()) == existing_tags

    for expense in Expense.objects.filter(recurring_id__isnull=False):
        assert list(expense.tags.values_list("name", flat=True).order_by("name")) == data["tags"]


@pytest.mark.parametrize("value", (10, -10))
def test__update__is_fixed__past__value(client, fixed_expenses, bank_account, value):
    # GIVEN
    expense = fixed_expenses[0]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value + value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }
    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.get(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, value=data["value"]
        )
        == expense
    )
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12


@pytest.mark.parametrize(("value", "operation"), ((10, operator.lt), (-10, operator.gt)))
def test__update__is_fixed__current__value(client, fixed_expenses, bank_account, value, operation):
    # GIVEN
    expense = fixed_expenses[2]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value + value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount - (data["value"] - expense.value) == bank_account.amount
    assert operation(bank_account.amount - previous_bank_account_amount, 0)

    assert (
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, value=data["value"]
        ).count()
        == 10
    )
    assert list(
        Expense.objects.filter(
            ~Q(value=data["value"]), recurring_id__isnull=False, recurring_id=expense.recurring_id
        ).values_list("id", flat=True)
    ) == [fixed_expenses[0].id, fixed_expenses[1].id]
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12


@pytest.mark.parametrize(("value", "operation"), ((10, operator.lt), (-10, operator.gt)))
def test__update__is_fixed__current__value__only_current(
    client, fixed_expenses, bank_account, value, operation
):
    # GIVEN
    expense = fixed_expenses[2]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value + value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=false", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount - (data["value"] - expense.value) == bank_account.amount
    assert operation(bank_account.amount - previous_bank_account_amount, 0)

    assert (
        Expense.objects.get(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, value=data["value"]
        )
        == expense
    )
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12


@pytest.mark.parametrize("value", (10, -10))
def test__update__is_fixed__future__value(client, fixed_expenses, bank_account, value):
    # GIVEN
    expense = fixed_expenses[3]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value + value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, value=data["value"]
        ).count()
        == 9
    )
    assert list(
        Expense.objects.filter(
            ~Q(value=data["value"]), recurring_id__isnull=False, recurring_id=expense.recurring_id
        )
        .order_by("id")
        .values_list("id", flat=True)
    ) == [fixed_expenses[0].id, fixed_expenses[1].id, fixed_expenses[2].id]
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12


@pytest.mark.parametrize("value", (10, -10))
def test__update__is_fixed__future__value__only_current(
    client, fixed_expenses, bank_account, value
):
    # GIVEN
    expense = fixed_expenses[4]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value + value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.get(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, value=data["value"]
        )
        == expense
    )
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12


def test__update__is_fixed__past__created_at(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[0]
    day = 10 if expense.created_at.day != 10 else 11
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": (expense.created_at.replace(day=day)).strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    assert (
        Expense.objects.get(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, created_at__day=day
        )
        == expense
    )
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12


def test__update__is_fixed__current__created_at(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[2]
    day = 10 if expense.created_at.day != 10 else 11
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": (expense.created_at.replace(day=day)).strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    assert (
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, created_at__day=day
        ).count()
        == 10
    )
    assert list(
        Expense.objects.filter(
            ~Q(created_at__day=day), recurring_id__isnull=False, recurring_id=expense.recurring_id
        ).values_list("id", flat=True)
    ) == [fixed_expenses[0].id, fixed_expenses[1].id]
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12


def test__update__is_fixed__current__created_at__only_current(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[2]
    day = 10 if expense.created_at.day != 10 else 11
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": (expense.created_at.replace(day=day)).strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=false", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    assert (
        Expense.objects.get(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, created_at__day=day
        )
        == expense
    )
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12


def test__update__is_fixed__future__created_at(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[6]
    day = 10 if expense.created_at.day != 10 else 11
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description + " abc",
        "category": expense.category,
        "created_at": (expense.created_at.replace(day=day)).strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    assert (
        Expense.objects.filter(
            recurring_id__isnull=False,
            recurring_id=expense.recurring_id,
            created_at__day=day,
            description=expense.description + " abc",
        ).count()
        == 6
    )
    assert list(
        Expense.objects.filter(
            ~Q(created_at__day=day),
            recurring_id__isnull=False,
            recurring_id=expense.recurring_id,
            description=expense.description,
        )
        .order_by("id")
        .values_list("id", flat=True)
    ) == [e.id for idx, e in enumerate(fixed_expenses) if idx < 6]
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12


def test__update__is_fixed__future__created_at__only_current(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[8]
    day = 10 if expense.created_at.day != 10 else 11
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description + " abc",
        "category": expense.category,
        "created_at": (expense.created_at.replace(day=day)).strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    assert (
        Expense.objects.get(
            recurring_id__isnull=False,
            recurring_id=expense.recurring_id,
            created_at__day=day,
            description=expense.description + " abc",
        )
        == expense
    )
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12


@pytest.mark.parametrize("perform", (True, False))
def test__update__is_fixed__false_to_true(client, expense, bank_account, perform):
    # GIVEN
    expense.is_fixed = False
    expense.recurring_id = None
    expense.save()

    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description + " abc",
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities={perform}", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    expense.refresh_from_db()
    assert expense.recurring_id is not None
    assert Expense.objects.filter(
        recurring_id__isnull=False,
        recurring_id=expense.recurring_id,
        description=expense.description,
    ).values("created_at__month", "created_at__year").distinct().count() == (12 if perform else 1)


@pytest.mark.parametrize("perform", (True, False))
def test__update__is_fixed__false_to_true__past_month(client, expense, bank_account, perform):
    # GIVEN
    expense.is_fixed = False
    expense.recurring_id = None
    expense.created_at = expense.created_at - relativedelta(months=1)
    expense.save()
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description + " abc",
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities={perform}", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    expense.refresh_from_db()
    assert expense.recurring_id is not None
    assert (
        Expense.objects.filter(
            recurring_id__isnull=False,
            recurring_id=expense.recurring_id,
            description=expense.description,
        )
        .values("created_at__month", "created_at__year")
        .distinct()
        .count()
        == 1
    )


@pytest.mark.parametrize("perform", (True, False))
def test__update__is_fixed__true_to_false(client, fixed_expenses, perform):
    # GIVEN
    expense = fixed_expenses[2]
    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": False,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities={perform}", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    expense.refresh_from_db()
    assert expense.recurring_id is None and not expense.is_fixed
    assert Expense.objects.filter(
        recurring_id__isnull=False,
    ).values(
        "created_at__month", "created_at__year"
    ).distinct().count() == (2 if perform else 11)


@pytest.mark.parametrize("perform", (True, False))
def test__update__is_fixed__true_to_false__past_month(client, fixed_expenses, perform):
    # GIVEN
    expense = fixed_expenses[1]
    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": False,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities={perform}", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    expense.refresh_from_db()
    assert expense.recurring_id is None and not expense.is_fixed
    assert (
        Expense.objects.filter(
            recurring_id__isnull=True,
        )
        .values("created_at__month", "created_at__year")
        .distinct()
        .count()
        == 1
    )


@pytest.mark.parametrize("delta", ({"months": 1}, {"months": -1}, {"years": 1}, {"years": -1}))
def test__update__is_fixed__past__created_at__to_another_month(client, fixed_expenses, delta):
    # GIVEN
    expense = fixed_expenses[0]

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": (expense.created_at + relativedelta(**delta)).strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "created_at": "Você só pode alterar a data de uma despesa fixa passada dentro do mesmo mês"
    }


@pytest.mark.parametrize("delta", ({"months": 1}, {"months": -1}, {"years": 1}, {"years": -1}))
def test__update__is_fixed__current__created_at__to_another_month(client, fixed_expenses, delta):
    # GIVEN
    expense = fixed_expenses[2]

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": (expense.created_at + relativedelta(**delta)).strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "created_at": "Você só pode alterar a data de uma despesa fixa passada dentro do mesmo mês"
    }


@pytest.mark.parametrize("delta", ({"months": 1}, {"months": -1}, {"years": 1}, {"years": -1}))
def test__update__is_fixed__future__created_at__to_another_month(client, fixed_expenses, delta):
    # GIVEN
    expense = fixed_expenses[6]

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": (expense.created_at + relativedelta(**delta)).strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "created_at": "Você só pode alterar a data de uma despesa fixa passada dentro do mesmo mês"
    }


def test__update__is_fixed__past__tags(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[0]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
        "tags": ["abc"],
    }
    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    for e in Expense.objects.filter(recurring_id=expense.recurring_id).exclude(pk=expense.pk):
        assert list(e.tags.values_list("name", flat=True).order_by("name")) == []

    assert list(expense.tags.values_list("name", flat=True).order_by("name")) == data["tags"]

    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12


def test__update__is_fixed__current__tags(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[2]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
        "tags": ["abc", "def"],
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=False
        )
        .distinct()
        .count()
        == 10
    )
    assert list(
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=True
        ).values_list("id", flat=True)
    ) == [fixed_expenses[0].id, fixed_expenses[1].id]
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12
    assert (
        list(
            Expense.objects.filter(
                recurring_id__isnull=False,
                recurring_id=expense.recurring_id,
                tags__isnull=False,
            )
            .distinct()
            .values_list("tags__name", flat=True)
            .order_by("tags__name")
        )
        == data["tags"]
    )


def test__update__is_fixed__current__tags__only_current(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[2]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
        "tags": ["abc", "def"],
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=false", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.distinct().get(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=False
        )
        == expense
    )

    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12
    assert (
        list(
            Expense.objects.filter(
                recurring_id__isnull=False,
                recurring_id=expense.recurring_id,
                tags__isnull=False,
            )
            .distinct()
            .values_list("tags__name", flat=True)
            .order_by("tags__name")
        )
        == data["tags"]
    )


# TODO: repeat for past and future
def test__update__is_fixed__current__tags__clear(client, user, fixed_expenses, bank_account):
    # GIVEN
    tag = ExpenseTag.objects.create(name="def", user=user)
    for e in fixed_expenses:
        e.tags.add(tag)

    expense = fixed_expenses[2]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=True
        )
        .distinct()
        .count()
        == 10
    )
    assert list(
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=False
        ).values_list("id", flat=True)
    ) == [fixed_expenses[0].id, fixed_expenses[1].id]
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12
    assert list(
        Expense.objects.filter(
            recurring_id__isnull=False,
            recurring_id=expense.recurring_id,
            tags__isnull=False,
        )
        .distinct()
        .values_list("tags__name", flat=True)
        .order_by("tags__name")
    ) == [tag.name]


def test__update__is_fixed__current__tags__clear__only_current(
    client, user, fixed_expenses, bank_account
):
    # GIVEN
    tag = ExpenseTag.objects.create(name="def", user=user)
    for e in fixed_expenses:
        e.tags.add(tag)

    expense = fixed_expenses[2]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=false", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=True
        )
        .distinct()
        .count()
        == 1
    )
    assert list(
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=False
        )
        .order_by("id")
        .values_list("id", flat=True)
        .distinct()
    ) == sorted([e.id for e in fixed_expenses if e != expense])
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12
    assert list(expense.tags.values_list("name", flat=True).order_by("name")) == []


# TODO: repeat for past, future and only_current
def test__update__is_fixed__current__tags__replace(
    client, user, fixed_expenses, expense_w_tags, bank_account
):
    # GIVEN
    tag = ExpenseTag.objects.create(name="def", user=user)
    for e in fixed_expenses:
        e.tags.add(tag)

    other_tags = list(expense_w_tags.tags.all())
    tags = [t.name for t in other_tags]

    expense = fixed_expenses[2]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
        "tags": tags,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=True
        )
        .distinct()
        .count()
        == 0
    )

    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12
    assert (
        list(
            Expense.objects.filter(
                recurring_id__isnull=False,
                recurring_id=expense.recurring_id,
                tags__isnull=False,
            )
            .exclude(id__in=(fixed_expenses[0].id, fixed_expenses[1].id))
            .distinct()
            .values_list("tags__name", flat=True)
            .order_by("tags__name")
        )
        == tags
    )
    assert list(
        Expense.objects.filter(id__in=(fixed_expenses[0].id, fixed_expenses[1].id))
        .distinct()
        .values_list("tags__name", flat=True)
        .order_by("tags__name")
    ) == [tag.name]

    assert list(
        ExpenseTag.objects.filter(user=expense.user).values_list("name", flat=True).order_by("name")
    ) == tags + [tag.name]

    expense_w_tags.refresh_from_db()
    assert list(expense_w_tags.tags.all()) == other_tags

    assert ExpenseTag.objects.count() == 2


# TODO: repeat for past, future and only_current
def test__update__is_fixed__current__tags__reuse__empty(
    client, fixed_expenses, expense_w_tags, bank_account
):
    # GIVEN
    existing_tags = list(expense_w_tags.tags.all())
    tags = [t.name for t in existing_tags] + ["def"]

    expense = fixed_expenses[2]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
        "tags": tags,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=False
        )
        .distinct()
        .count()
        == 10
    )
    assert list(
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=True
        ).values_list("id", flat=True)
    ) == [fixed_expenses[0].id, fixed_expenses[1].id]

    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12
    assert (
        list(
            Expense.objects.filter(
                recurring_id__isnull=False,
                recurring_id=expense.recurring_id,
                tags__isnull=False,
            )
            .exclude(id__in=(fixed_expenses[0].id, fixed_expenses[1].id))
            .distinct()
            .values_list("tags__name", flat=True)
            .order_by("tags__name")
        )
        == tags
    )

    assert (
        list(
            ExpenseTag.objects.filter(user=expense.user)
            .values_list("name", flat=True)
            .order_by("name")
        )
        == tags
    )

    expense_w_tags.refresh_from_db()
    assert list(expense_w_tags.tags.all()) == existing_tags

    assert ExpenseTag.objects.count() == 2


# TODO: repeat for past, future and only_current
def test__update__is_fixed__current__tags__reuse__replace(
    client, user, fixed_expenses, expense_w_tags, bank_account
):
    # GIVEN
    tag = ExpenseTag.objects.create(name="def", user=user)
    for e in fixed_expenses:
        e.tags.add(tag)

    other_tags = list(expense_w_tags.tags.all())
    tags = [t.name for t in other_tags]

    expense = fixed_expenses[2]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
        "tags": tags,
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=False
        )
        .distinct()
        .count()
        == 12
    )

    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12
    assert (
        list(
            Expense.objects.filter(
                recurring_id__isnull=False,
                recurring_id=expense.recurring_id,
                tags__isnull=False,
            )
            .exclude(id__in=(fixed_expenses[0].id, fixed_expenses[1].id))
            .distinct()
            .values_list("tags__name", flat=True)
            .order_by("tags__name")
        )
        == tags
    )
    assert list(
        Expense.objects.filter(id__in=(fixed_expenses[0].id, fixed_expenses[1].id))
        .distinct()
        .values_list("tags__name", flat=True)
        .order_by("tags__name")
    ) == [tag.name]

    assert list(
        ExpenseTag.objects.filter(user=expense.user).values_list("name", flat=True).order_by("name")
    ) == tags + [tag.name]

    expense_w_tags.refresh_from_db()
    assert list(expense_w_tags.tags.all()) == other_tags

    assert ExpenseTag.objects.count() == 2


def test__update__is_fixed__future__tags(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[3]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
        "tags": ["abc", "def"],
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=False
        )
        .distinct()
        .count()
        == 9
    )
    assert list(
        Expense.objects.filter(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=True
        )
        .order_by("id")
        .values_list("id", flat=True)
    ) == [fixed_expenses[0].id, fixed_expenses[1].id, fixed_expenses[2].id]
    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12
    assert (
        list(
            Expense.objects.filter(
                recurring_id__isnull=False,
                recurring_id=expense.recurring_id,
                tags__isnull=False,
            )
            .distinct()
            .values_list("tags__name", flat=True)
            .order_by("tags__name")
        )
        == data["tags"]
    )


def test__update__is_fixed__future__tags__only_current(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[3]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
        "is_fixed": True,
        "tags": ["abc", "def"],
    }

    # WHEN
    response = client.put(
        f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=false", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.distinct().get(
            recurring_id__isnull=False, recurring_id=expense.recurring_id, tags__isnull=False
        )
        == expense
    )

    assert Expense.objects.values("created_at__month", "created_at__year").distinct().count() == 12
    assert (
        list(
            Expense.objects.filter(
                recurring_id__isnull=False,
                recurring_id=expense.recurring_id,
                tags__isnull=False,
            )
            .distinct()
            .values_list("tags__name", flat=True)
            .order_by("tags__name")
        )
        == data["tags"]
    )


def test__update__installments__is_fixed(client, expenses_w_installments):
    # GIVEN
    e = expenses_w_installments[2]
    data = {
        "value": e.value,
        "description": e.description,
        "category": e.category,
        "created_at": e.created_at.strftime("%d/%m/%Y"),
        "source": e.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"installments": "Despesas fixas não podem ser parceladas"}


def test__delete__is_fixed__past(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[0]

    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.delete(f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.filter(recurring_id__isnull=False, recurring_id=expense.recurring_id)
        .values("created_at__month", "created_at__year")
        .count()
        == 11
    )


def test__delete__is_fixed__current(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[2]

    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.delete(f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    bank_account.refresh_from_db()
    assert previous_bank_account_amount + expense.value == bank_account.amount

    assert (
        Expense.objects.filter(recurring_id__isnull=False, recurring_id=expense.recurring_id)
        .values("created_at__month", "created_at__year")
        .count()
        == 2
    )
    assert list(
        Expense.objects.filter(recurring_id__isnull=False, recurring_id=expense.recurring_id)
        .order_by("id")
        .values_list("id", flat=True)
    ) == [fixed_expenses[0].id, fixed_expenses[1].id]


def test__delete__is_fixed__future(client, fixed_expenses, bank_account):
    # GIVEN
    expense = fixed_expenses[7]

    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.delete(f"{URL}/{expense.pk}?perform_actions_on_future_fixed_entities=true")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Expense.objects.filter(recurring_id__isnull=False, recurring_id=expense.recurring_id)
        .values("created_at__month", "created_at__year")
        .count()
        == 7
    )
    assert list(
        Expense.objects.filter(
            recurring_id__isnull=False,
            recurring_id=expense.recurring_id,
        )
        .order_by("id")
        .values_list("id", flat=True)
    ) == [e.id for idx, e in enumerate(fixed_expenses) if idx < 7]
