import operator
from datetime import datetime
from decimal import Decimal
from typing import Literal

from django.db.models import Avg, Q, Sum
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

from ...choices import CREDIT_CARD_SOURCE, MONEY_SOURCE, PIX_SOURCE
from ...models import Expense, ExpenseTag

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "expenses"


@pytest.mark.usefixtures("expenses")
@pytest.mark.parametrize(
    "filter_by, count",
    [
        ("", 12),
        ("description=Expense", 12),
        ("description=pense", 12),
        ("description=wrong", 0),
        ("is_fixed=False", 6),
        ("is_fixed=True", 6),
    ],
)
def test__list(client, filter_by, count):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}?{filter_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == count


def test__list__filter_multiple_categories(client, expense, another_expense, yet_another_expense):
    # GIVEN
    yet_another_expense.category = "Transporte"
    yet_another_expense.save()

    # WHEN
    response = client.get(f"{URL}?category=Casa&category=Lazer")

    # THEN
    assert response.status_code == HTTP_200_OK

    assert response.json()["count"] == 2
    assert sorted([r["id"] for r in response.json()["results"]]) == sorted(
        [expense.id, another_expense.id]
    )


def test__list__filter_multiple_sources(client, expense, another_expense, yet_another_expense):
    # GIVEN
    yet_another_expense.source = PIX_SOURCE
    yet_another_expense.save()

    # WHEN
    response = client.get(f"{URL}?source={CREDIT_CARD_SOURCE}&source={MONEY_SOURCE}")

    # THEN
    assert response.status_code == HTTP_200_OK

    assert response.json()["count"] == 2
    assert sorted([r["id"] for r in response.json()["results"]]) == sorted(
        [expense.id, another_expense.id]
    )


@pytest.mark.usefixtures("expenses2")
@pytest.mark.parametrize(
    "filter_date_type, filter_field, count",
    (
        (None, None, 48),
        ("future", "start", 24),
        ("current", "start", 25),
        ("future", "end", 25),
        ("current", "end", 24),
    ),
)
def test__list__filter_by_date(
    client,
    filter_date_type: Literal["future", "current"] | None,
    filter_field: Literal["start", "end"] | None,
    count,
):
    # GIVEN
    if filter_date_type is None or filter_field is None:
        f = ""
        order_by = "-created_at"
    else:
        if filter_date_type == "future":
            d = str(timezone.localdate() + relativedelta(months=1))
        elif filter_date_type == "current":
            d = str(timezone.localdate())

        if filter_field == "start":
            f = f"start_date={d}"
            order_by = "created_at"
        elif filter_field == "end":
            f = f"end_date={d}"
            order_by = "-created_at"

    # WHEN
    response = client.get(f"{URL}?{f}&page_size=100")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == count
    assert (
        Expense.objects.order_by(order_by).only("id").last().id
        == response.json()["results"][-1]["id"]
    )


@pytest.mark.parametrize("is_fixed", (True, False))
def test__list__include_date_fixed_expense(client, expense, is_fixed):
    # GIVEN
    if not is_fixed:
        expense.is_fixed = is_fixed
        expense.recurring_id = None
        expense.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    if is_fixed:
        assert response.json()["results"][0]["full_description"] == expense.full_description
    else:
        assert response.json()["results"][0]["full_description"] == expense.description


@pytest.mark.usefixtures("expenses_w_installments")
def test__list__installments(client):
    # GIVEN
    f = f"start_date={str(timezone.localdate() + relativedelta(months=1))}"

    # WHEN
    response = client.get(f"{URL}?{f}&page_size=100")

    # THEN
    assert response.status_code == HTTP_200_OK

    for r in response.json()["results"]:
        assert r["id"] == int(r["full_description"].split("(")[-1][0])


def test__list__tags(client, expense_w_tags):
    # GIVEN
    tags = list(expense_w_tags.tags.values_list("name", flat=True))

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    assert response.json()["count"] == 1
    assert response.json()["results"][0]["tags"] == tags


def test__create(client, user, bank_account):
    # GIVEN
    today = timezone.localdate()
    previous_bank_account_amount = bank_account.amount
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": today.strftime("%d/%m/%Y"),
        "source": MONEY_SOURCE,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert Expense.objects.count() == 1

    data.update({"created_at": today})
    assert Expense.objects.filter(
        **data,
        user=user,
        is_fixed=False,
        recurring_id__isnull=True,
        installments_id__isnull=True,
        installment_number__isnull=True,
        installments_qty__isnull=True,
    ).exists()

    assert ExpenseTag.objects.count() == 0

    bank_account.refresh_from_db()
    assert previous_bank_account_amount - data["value"] == bank_account.amount


def test__create__tags(client, user, bank_account):
    # GIVEN
    today = timezone.localdate()
    previous_bank_account_amount = bank_account.amount
    tags = ["abc", "def"]
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": today.strftime("%d/%m/%Y"),
        "source": MONEY_SOURCE,
    }

    # WHEN
    response = client.post(URL, data={**data, "tags": tags})

    # THEN
    assert response.status_code == HTTP_201_CREATED

    data.update({"created_at": today})
    assert Expense.objects.filter(
        **data,
        user=user,
        is_fixed=False,
        recurring_id__isnull=True,
        installments_id__isnull=True,
        installment_number__isnull=True,
        installments_qty__isnull=True,
    ).exists()

    assert list(Expense.objects.get().tags.values_list("name", flat=True).order_by("name")) == tags

    bank_account.refresh_from_db()
    assert previous_bank_account_amount - data["value"] == bank_account.amount


def test__create__tags__reuse(client, user, bank_account, expense_w_tags):
    # GIVEN
    today = timezone.localdate()
    previous_bank_account_amount = bank_account.amount
    existing_tags = list(expense_w_tags.tags.all())
    tags = [t.name for t in existing_tags] + ["def"]
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": today.strftime("%d/%m/%Y"),
        "source": MONEY_SOURCE,
    }

    # WHEN
    response = client.post(URL, data={**data, "tags": tags})

    # THEN
    assert response.status_code == HTTP_201_CREATED

    data.update({"created_at": today})
    assert Expense.objects.filter(
        **data,
        user=user,
        is_fixed=False,
        recurring_id__isnull=True,
        installments_id__isnull=True,
        installment_number__isnull=True,
        installments_qty__isnull=True,
    ).exists()

    assert (
        list(
            Expense.objects.get(description="Test")
            .tags.values_list("name", flat=True)
            .order_by("name")
        )
        == tags
    )

    assert (
        list(ExpenseTag.objects.filter(user=user).values_list("name", flat=True).order_by("name"))
        == tags
    )

    assert list(expense_w_tags.tags.all()) == existing_tags

    bank_account.refresh_from_db()
    assert previous_bank_account_amount - data["value"] == bank_account.amount


def test__create__tags__empty(client, user, bank_account):
    # GIVEN
    today = timezone.localdate()
    previous_bank_account_amount = bank_account.amount
    tags = []
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": today.strftime("%d/%m/%Y"),
        "source": MONEY_SOURCE,
    }

    # WHEN
    response = client.post(URL, data={**data, "tags": tags})

    # THEN
    assert response.status_code == HTTP_201_CREATED

    data.update({"created_at": today})
    assert Expense.objects.filter(
        **data,
        user=user,
        is_fixed=False,
        recurring_id__isnull=True,
        installments_id__isnull=True,
        installment_number__isnull=True,
        installments_qty__isnull=True,
    ).exists()

    assert list(Expense.objects.get().tags.values_list("name", flat=True).order_by("name")) == tags

    bank_account.refresh_from_db()
    assert previous_bank_account_amount - data["value"] == bank_account.amount


@pytest.mark.skip("Skipe while not sure if this should be an error")
def test__create__future__not_credit_card(client):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2121",
        "source": MONEY_SOURCE,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {
        "created_at__source": "Uma despesa futura só pode ser realizada usando cartão de crédito"
    }


def test__create__future__credit_card(client, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2121",
        "source": CREDIT_CARD_SOURCE,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


def test__create__installments(client, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    installments = 3
    data = {
        "value": 12,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2021",
        "source": CREDIT_CARD_SOURCE,
        "installments": installments,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert (
        Expense.objects.filter(installments_id__isnull=False, recurring_id__isnull=True).count()
        == installments
    )
    for i, expense in enumerate(
        Expense.objects.filter(installments_id__isnull=False).order_by("created_at")
    ):
        assert expense.created_at.month == i + 1
        assert f"({i+1}/{installments})" in expense.full_description
        assert expense.value == data["value"] / installments

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


def test__create__installments__tags(client, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    installments = 3
    data = {
        "value": 12,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2021",
        "source": CREDIT_CARD_SOURCE,
        "installments": installments,
        "tags": ["abc", "def"],
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert (
        Expense.objects.filter(installments_id__isnull=False, recurring_id__isnull=True).count()
        == installments
    )
    for i, expense in enumerate(
        Expense.objects.filter(installments_id__isnull=False).order_by("created_at")
    ):
        assert expense.created_at.month == i + 1
        assert f"({i+1}/{installments})" in expense.full_description
        assert expense.value == data["value"] / installments
        assert list(expense.tags.values_list("name", flat=True).order_by("name")) == data["tags"]

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


def test__create__installments__tags__reuse(client, bank_account, expense_w_tags):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    installments = 3
    existing_tags = list(expense_w_tags.tags.all())
    tags = [t.name for t in existing_tags] + ["def"]
    data = {
        "value": 12,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2021",
        "source": CREDIT_CARD_SOURCE,
        "installments": installments,
        "tags": tags,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert (
        Expense.objects.filter(installments_id__isnull=False, recurring_id__isnull=True).count()
        == installments
    )
    for expense in Expense.objects.filter(installments_id__isnull=False):
        assert list(expense.tags.values_list("name", flat=True).order_by("name")) == data["tags"]

    assert (
        list(
            ExpenseTag.objects.filter(user=expense.user)
            .values_list("name", flat=True)
            .order_by("name")
        )
        == tags
    )

    assert list(expense_w_tags.tags.all()) == existing_tags

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


def test__create__installments__none(client):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2021",
        "source": CREDIT_CARD_SOURCE,
        "installments": None,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Expense.objects.count() == 1


def test__create__installments__source_not_credit_card(client):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2021",
        "source": MONEY_SOURCE,
        "installments": 2,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"installments": "Despesas parceladas devem ser no cartão de crédito"}


@pytest.mark.parametrize("value", (-1, 0))
def test__create__invalid_value(client, value):
    # GIVEN
    data = {
        "value": value,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2021",
        "source": "Teste",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"value": ["Ensure this value is greater than or equal to 0.01."]}


def test__create__new_category(client):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "CNPJ",
        "created_at": "01/01/2021",
        "source": "Teste",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {"category": "A categoria não existe"}


def test__create__new_source(client):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2021",
        "source": "Cheque",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {"source": "A fonte não existe"}


@pytest.mark.parametrize(
    ("value", "operation"), ((10, operator.lt), (-10, operator.gt), (0, operator.eq))
)
def test__update(client, expense, bank_account, value, operation):
    # GIVEN
    expense.is_fixed = False
    expense.recurring_id = None
    expense.save()
    previous_bank_account_amount = bank_account.amount
    data = {
        "value": expense.value + value,
        "description": "Test",
        "category": "Casa",
        "created_at": (timezone.localdate()).strftime("%d/%m/%Y"),
        "source": MONEY_SOURCE,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount - value == bank_account.amount
    assert operation(bank_account.amount - previous_bank_account_amount, 0)

    expense.refresh_from_db()
    assert expense.value == Decimal(data["value"])
    assert expense.description == data["description"]
    assert expense.category == data["category"]
    assert expense.created_at == datetime.strptime(data["created_at"], "%d/%m/%Y").date()
    assert expense.source == data["source"]
    assert not expense.is_fixed

    assert ExpenseTag.objects.count() == 0

    # make sure we are not creating future fixed expenses
    assert Expense.objects.count() == 1


def test__update__tags(client, expense, bank_account):
    # GIVEN
    expense.is_fixed = False
    expense.recurring_id = None
    expense.save()

    previous_bank_account_amount = bank_account.amount
    data = {
        "value": expense.value,
        "description": "Test",
        "category": "Casa",
        "created_at": (timezone.localdate()).strftime("%d/%m/%Y"),
        "source": MONEY_SOURCE,
        "tags": ["def"],
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    expense.refresh_from_db()
    assert expense.value == Decimal(data["value"])
    assert expense.description == data["description"]
    assert expense.category == data["category"]
    assert expense.created_at == datetime.strptime(data["created_at"], "%d/%m/%Y").date()
    assert expense.source == data["source"]
    assert not expense.is_fixed
    assert list(expense.tags.values_list("name", flat=True).order_by("name")) == data["tags"]

    # make sure we are not creating future fixed expenses
    assert Expense.objects.count() == 1


def test__update__tags__clear(client, expense_w_tags, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    tags = expense_w_tags.tags.all()
    data = {
        "value": expense_w_tags.value,
        "description": expense_w_tags.description,
        "category": expense_w_tags.category,
        "created_at": (expense_w_tags.created_at).strftime("%d/%m/%Y"),
        "source": expense_w_tags.source,
    }

    # WHEN
    response = client.put(f"{URL}/{expense_w_tags.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    expense_w_tags.refresh_from_db()
    assert expense_w_tags.tags.count() == 0
    assert tags.count() == 0


def test__update__tags__replace(client, expense_w_tags, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    data = {
        "value": expense_w_tags.value,
        "description": expense_w_tags.description,
        "category": expense_w_tags.category,
        "created_at": (expense_w_tags.created_at).strftime("%d/%m/%Y"),
        "source": expense_w_tags.source,
        "tags": ["def"],
    }

    # WHEN
    response = client.put(f"{URL}/{expense_w_tags.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    expense_w_tags.refresh_from_db()
    assert list(expense_w_tags.tags.values_list("name", flat=True).order_by("name")) == data["tags"]

    assert ExpenseTag.objects.count() == 2


def test__update__tags__reuse__empty(client, expense, expense_w_tags, bank_account):
    # GIVEN
    existing_tags = list(expense_w_tags.tags.all())
    tags = [t.name for t in existing_tags] + ["def"]
    previous_bank_account_amount = bank_account.amount
    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": (expense.created_at).strftime("%d/%m/%Y"),
        "source": expense.source,
        "tags": tags,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    expense.refresh_from_db()
    assert list(expense.tags.values_list("name", flat=True).order_by("name")) == tags
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


def test__update__tags__reuse__replace(client, expense, expense_w_tags, bank_account):
    # GIVEN
    tag = ExpenseTag.objects.create(name="def", user=expense.user)
    expense.tags.add(tag)

    other_tags = list(expense_w_tags.tags.all())
    tags = [t.name for t in other_tags]
    previous_bank_account_amount = bank_account.amount
    data = {
        "value": expense.value,
        "description": expense.description,
        "category": expense.category,
        "created_at": (expense.created_at).strftime("%d/%m/%Y"),
        "source": expense.source,
        "tags": tags,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    expense.refresh_from_db()
    assert list(expense.tags.values_list("name", flat=True).order_by("name")) == tags
    assert list(
        ExpenseTag.objects.filter(user=expense.user).values_list("name", flat=True).order_by("name")
    ) == tags + [tag.name]

    expense_w_tags.refresh_from_db()
    assert list(expense_w_tags.tags.all()) == other_tags

    assert ExpenseTag.objects.count() == 2


@pytest.mark.skip("Skipe while not sure if this should be an error")
def test__update__future__not_credit_card(client, expense):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2121",
        "source": MONEY_SOURCE,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {
        "created_at__source": "Uma despesa futura só pode ser realizada usando cartão de crédito"
    }


def test__update__future__credit_card(client, expense, bank_account):
    # GIVEN
    expense.is_fixed = False
    expense.recurring_id = None
    expense.save()

    previous_bank_account_amount = bank_account.amount
    data = {
        "value": 12.00,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/01/2121",
        "source": CREDIT_CARD_SOURCE,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


@pytest.mark.parametrize("value", (10, -10, 0))
def test__update__installments__value(client, expenses_w_installments, bank_account, value):
    # GIVEN
    for e in expenses_w_installments:
        e.created_at -= relativedelta(months=2)
        e.save()
    previous_bank_account_amount = bank_account.amount
    e = expenses_w_installments[0]
    data = {
        "value": e.value + value,
        "description": e.description,
        "category": e.category,
        "created_at": e.created_at.strftime("%d/%m/%Y"),
        "source": e.source,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert Expense.objects.filter(
        installments_id=e.installments_id, value=data["value"], recurring_id__isnull=True
    ).count() == len(expenses_w_installments)


def test__update__installments__add_tags(client, expenses_w_installments, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    e = expenses_w_installments[0]
    data = {
        "value": e.value,
        "description": e.description,
        "category": e.category,
        "created_at": e.created_at.strftime("%d/%m/%Y"),
        "source": e.source,
        "tags": ["abc", "tag"],
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    for expense in Expense.objects.filter(installments_id=e.installments_id):
        assert list(expense.tags.values_list("name", flat=True).order_by("name")) == data["tags"]

    assert ExpenseTag.objects.count() == len(data["tags"])


def test__update__installments__tags__reuse__empty(
    client, expenses_w_installments, expense_w_tags, bank_account
):
    # GIVEN
    existing_tags = list(expense_w_tags.tags.all())
    tags = [t.name for t in existing_tags] + ["def"]
    previous_bank_account_amount = bank_account.amount
    e = expenses_w_installments[0]
    data = {
        "value": e.value,
        "description": e.description,
        "category": e.category,
        "created_at": e.created_at.strftime("%d/%m/%Y"),
        "source": e.source,
        "tags": tags,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    for expense in Expense.objects.filter(installments_id=e.installments_id):
        assert list(expense.tags.values_list("name", flat=True).order_by("name")) == data["tags"]

    assert ExpenseTag.objects.count() == len(data["tags"])

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


def test__update__installments__tags__reuse__replace(
    client, expenses_w_installments, expense_w_tags, bank_account, yet_another_expense
):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    e = expenses_w_installments[0]

    tag = ExpenseTag.objects.create(name="def", user=e.user)
    for expense in expenses_w_installments:
        expense.tags.add(tag)

    yet_another_expense.tags.add(tag)

    other_tags = list(expense_w_tags.tags.all())
    tags = [t.name for t in other_tags]
    data = {
        "value": e.value,
        "description": e.description,
        "category": e.category,
        "created_at": e.created_at.strftime("%d/%m/%Y"),
        "source": e.source,
        "tags": tags,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    for expense in Expense.objects.filter(installments_id=e.installments_id):
        assert list(expense.tags.values_list("name", flat=True).order_by("name")) == data["tags"]

    assert ExpenseTag.objects.count() == 2

    assert list(
        ExpenseTag.objects.filter(user=expense.user).values_list("name", flat=True).order_by("name")
    ) == tags + [tag.name]

    expense_w_tags.refresh_from_db()
    assert list(expense_w_tags.tags.all()) == other_tags


@pytest.mark.parametrize(
    ("value", "operation"), ((10, operator.lt), (-10, operator.gt), (0, operator.eq))
)
def test__update__installments__value__not_1st_expense(
    client, expenses_w_installments, bank_account, value, operation
):
    # GIVEN
    for e in expenses_w_installments:
        e.created_at -= relativedelta(months=2)
        e.save()
    previous_bank_account_amount = bank_account.amount
    e = expenses_w_installments[2]
    data = {
        "value": e.value + value,
        "description": e.description,
        "category": e.category,
        "created_at": e.created_at.strftime("%d/%m/%Y"),
        "source": e.source,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    already_decremented_expenses_count = Expense.objects.filter(
        installments_id=e.installments_id, created_at__lte=timezone.localdate()
    ).count()

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert (
        previous_bank_account_amount
        - (already_decremented_expenses_count * (data["value"] - e.value))
        == bank_account.amount
    )
    assert operation(bank_account.amount - previous_bank_account_amount, 0)

    assert Expense.objects.filter(
        installments_id=e.installments_id, value=data["value"], recurring_id__isnull=True
    ).count() == len(expenses_w_installments)


def test__update__installments__created_at_and_value(client, expenses_w_installments, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    e = expenses_w_installments[0]
    created_at = datetime(year=2021, month=12, day=3)
    data = {
        "value": e.value + 10,
        "description": e.description,
        "category": e.category,
        "created_at": created_at.strftime("%d/%m/%Y"),
        "source": e.source,
    }
    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    for i, expense in enumerate(
        Expense.objects.filter(installments_id=e.installments_id, value=data["value"]).order_by(
            "created_at"
        )
    ):
        assert expense.created_at == (created_at + relativedelta(months=i)).date()
        assert expense.id == expense.installment_number


def test__update__installments__created_at__not_1st_installment(client, expenses_w_installments):
    # GIVEN
    e = expenses_w_installments[3]
    created_at = datetime(year=2021, month=12, day=3)
    data = {
        "value": e.value,
        "description": e.description,
        "category": e.category,
        "created_at": created_at.strftime("%d/%m/%Y"),
        "source": e.source,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"created_at": "Você só pode alterar a data da primeira parcela"}


def test__update__installments__source_not_credit_card(client, expenses_w_installments):
    # GIVEN
    e = expenses_w_installments[4]
    data = {
        "value": e.value,
        "description": e.description,
        "category": e.category,
        "created_at": e.created_at.strftime("%d/%m/%Y"),
        "source": MONEY_SOURCE,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"installments": "Despesas parceladas devem ser no cartão de crédito"}


@pytest.mark.parametrize("value", (-1, 0))
def test__update__invalid_value(client, expense, value):
    # GIVEN
    data = {
        "value": value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"value": ["Ensure this value is greater than or equal to 0.01."]}


def test__update__new_category(client, expense):
    # GIVEN
    data = {
        "value": expense.value,
        "description": expense.description,
        "category": "CNPJ",
        "created_at": "01/01/2021",
        "source": expense.source,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {"category": "A categoria não existe"}


def test__delete(client, expense, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.delete(f"{URL}/{expense.pk}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    bank_account.refresh_from_db()
    assert previous_bank_account_amount + expense.value == bank_account.amount

    assert not Expense.objects.exists()


def test__delete__installments(client, expenses_w_installments, bank_account):
    # GIVEN
    for e in expenses_w_installments:
        e.created_at -= relativedelta(months=1)
        e.save()

    incremented_value = Expense.objects.filter(
        installments_id=e.installments_id, created_at__lte=timezone.localdate()
    ).aggregate(total=Sum("value"))["total"]
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.delete(f"{URL}/{e.pk}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    bank_account.refresh_from_db()
    assert previous_bank_account_amount + incremented_value == bank_account.amount

    assert not Expense.objects.exists()


@pytest.mark.usefixtures("expenses_report_data")
@pytest.mark.parametrize(
    ("filters", "db_filters"),
    (
        ("future=false", {}),
        ("future=true", {}),
        ("future=false&category=Casa", {"category": "Casa"}),
    ),
)
def test__historic(client, user, filters, db_filters):
    # GIVEN
    today = timezone.localdate()
    qs = Expense.objects.filter(user_id=user.id, **db_filters)

    # WHEN
    response = client.get(f"{URL}/historic?{filters}")
    response_json = response.json()

    # THEN
    assert response.status_code == HTTP_200_OK

    total = 0
    for result in response_json["historic"]:
        d = datetime.strptime(result["month"], "%d/%m/%Y").date()
        assert convert_and_quantitize(result["total"]) == convert_and_quantitize(
            qs.filter(created_at__month=d.month, created_at__year=d.year).sum()["total"]
        )
        if d == today.replace(day=1):  # we don't evaluate the current month on the avg calculation
            continue
        total += result["total"]

    assert convert_and_quantitize(response_json["avg"]) == convert_and_quantitize(
        qs.monthly_avg()["avg"] if "future=true" not in filters else 0
    )


@pytest.mark.usefixtures("expenses_report_data")
def test__indicators(client, user):
    # GIVEN
    today = timezone.localdate()
    qs = Expense.objects.filter(user_id=user.id)
    avg = (
        qs.since_a_year_ago()
        .exclude(created_at__month=today.month, created_at__year=today.year)
        .trunc_months()
        .aggregate(avg=Avg("total"))["avg"]
    )
    total = Expense.objects.filter(
        created_at__month=today.month, created_at__year=today.year
    ).sum()["total"]
    future = qs.filter(
        Q(created_at__month__gt=today.month, created_at__year=today.year)
        | Q(created_at__year__gt=today.year)
    ).sum()["total"]

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    response_json = response.json()

    assert response.status_code == HTTP_200_OK
    assert response_json == {
        "total": convert_and_quantitize(total),
        "avg": convert_and_quantitize(avg),
        "diff": convert_and_quantitize(((total / avg) - Decimal("1.0")) * Decimal("100.0")),
        "future": convert_and_quantitize(future),
    }


@pytest.mark.usefixtures("expenses_report_data")
def test__sum(client, user):
    # GIVEN
    today = timezone.localdate()
    one_month_later = today + relativedelta(months=1)
    total = Expense.objects.filter(
        user_id=user.id, created_at__range=(today, one_month_later)
    ).sum()["total"]

    # WHEN
    response = client.get(
        f"{URL}/sum?start_date={today.strftime('%d/%m/%Y')}"
        + f"&end_date={one_month_later.strftime('%d/%m/%Y')}"
    )

    # THEN
    response_json = response.json()

    assert response.status_code == HTTP_200_OK
    assert response_json == {"total": convert_and_quantitize(total)}


@pytest.mark.usefixtures("expenses_report_data")
def test__avg(client, user):
    # GIVEN
    today = timezone.localdate()
    avg = (
        Expense.objects.filter(user_id=user.id)
        .since_a_year_ago()
        .exclude(created_at__month=today.month, created_at__year=today.year)
        .trunc_months()
        .aggregate(avg=Avg("total"))["avg"]
    )

    # WHEN
    response = client.get(f"{URL}/avg")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == {"avg": convert_and_quantitize(avg)}


@pytest.mark.usefixtures("expenses_report_data")
def test__higher_value(client, user):
    # GIVEN
    today = timezone.localdate()
    one_month_later = today + relativedelta(months=1)
    expense = max(
        Expense.objects.filter(user_id=user.id, created_at__range=(today, one_month_later)),
        key=lambda e: e.value,
    )

    # WHEN
    response = client.get(
        f"{URL}/higher_value?start_date={today.strftime('%d/%m/%Y')}"
        + f"&end_date={one_month_later.strftime('%d/%m/%Y')}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["id"] == expense.id


def test__indicators__wo_data(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == {"total": 0.0, "avg": 0.0, "diff": 0.0, "future": 0.0}


def test__forbidden__module_not_enabled(user, client):
    # GIVEN
    user.is_personal_finances_module_enabled = False
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Você não tem acesso ao módulo de finanças pessoais"}


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
