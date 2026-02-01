import pytest
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
)

from config.settings.base import BASE_API_URL

from ...choices import (
    CREDIT_CARD_SOURCE,
    DEFAULT_CATEGORIES_MAP,
    DEFAULT_SOURCES_MAP,
    MONEY_SOURCE,
    Colors,
)
from ...models import Expense, ExpenseCategory, ExpenseSource

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "expenses"


def _remove_key_from_dict(d: dict, *keys):
    return {k: v for k, v in d.items() if k not in keys}


def _remove_key_from_dicts(lst: list[dict], *keys):
    return [_remove_key_from_dict(d, *keys) for d in lst]


def test__list__categories(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/categories?page_size=10")

    # THEN
    assert response.status_code == HTTP_200_OK

    assert sorted(
        _remove_key_from_dicts(response.json()["results"], "id"), key=lambda r: r["name"]
    ) == sorted(
        [
            {"name": category, "hex_color": color, "exclude_from_fire": False}
            for category, color in DEFAULT_CATEGORIES_MAP.items()
        ],
        key=lambda r: r["name"],
    )


@pytest.mark.parametrize("direction", ("asc", "desc"))
@pytest.mark.usefixtures("expense", "another_expense", "yet_another_expense")
def test__list__categories__most_common_ordering(client, direction):
    # GIVEN
    house_category = ExpenseCategory.objects.values("id", "name", "hex_color").get(name="Casa")
    fun_category: ExpenseCategory = ExpenseCategory.objects.values("id", "name", "hex_color").get(
        name="Lazer"
    )
    expected = [fun_category, house_category]
    if direction == "desc":
        expected = list(reversed(expected))

    # WHEN
    response = client.get(
        f"{URL}/categories?page_size=10&ordering={'-' if direction == 'desc' else ''}"
        "num_of_appearances"
    )

    # THEN
    assert response.json()["results"] == expected


@pytest.mark.usefixtures("expense", "another_expense", "yet_another_expense")
def test__most_common__categories(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/categories/most_common")

    # THEN
    assert response.status_code == HTTP_200_OK

    assert _remove_key_from_dict(response.json(), "id") == {
        "name": "Casa",
        "hex_color": DEFAULT_CATEGORIES_MAP["Casa"],
    }


def test__create__categories(client, user):
    # GIVEN
    data = {"name": "name", "hex_color": Colors.orange1}

    # WHEN
    response = client.post(f"{URL}/categories", data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert ExpenseCategory.objects.filter(user=user, **data).exists()


def test__create__categories__undo_soft_delete(client, user, default_categories):
    # GIVEN
    data = {"name": "Lazer", "hex_color": Colors.orange1}
    fun_category: ExpenseCategory = next(c for c in default_categories if c.name == data["name"])
    fun_category.deleted = True
    fun_category.save()

    # WHEN
    response = client.post(f"{URL}/categories", data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert ExpenseCategory.objects.filter(user=user, deleted=False, **data).exists()


def test__create__categories__validate_unique_name(client):
    # GIVEN
    data = {"name": "Lazer", "hex_color": Colors.orange1}

    # WHEN
    response = client.post(f"{URL}/categories", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {"name": "Os nomes precisam ser únicos"}


def test__create__categories__validate_color(client):
    # GIVEN
    data = {"name": "name", "hex_color": "#4287f5"}

    # WHEN
    response = client.post(f"{URL}/categories", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {
        "hex_color": ["Select a valid choice. #4287f5 is not one of the available choices."]
    }


@pytest.mark.usefixtures("fixed_expenses", "yet_another_expense")
def test__update__categories(client):
    # GIVEN
    category = ExpenseCategory.objects.get(name="Casa")
    data = {"name": "name", "hex_color": Colors.orange1}

    # WHEN
    response = client.put(f"{URL}/categories/{category.id}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    category.refresh_from_db()
    assert category.name == data["name"]
    assert category.hex_color == data["hex_color"]

    assert not Expense.objects.filter(category="Casa").exists()
    assert Expense.objects.filter(category=data["name"], expanded_category=category).exists()


@pytest.mark.usefixtures("fixed_expenses", "yet_another_expense")
def test__update__categories__undo_soft_delete(client, user, default_categories):
    # GIVEN
    data = {"name": "Lazer", "hex_color": Colors.orange1}
    fun_category: ExpenseCategory = next(c for c in default_categories if c.name == data["name"])
    fun_category.deleted = True
    fun_category.save()

    house_category: ExpenseCategory = next(c for c in default_categories if c.name == "Casa")

    # WHEN
    response = client.put(f"{URL}/categories/{house_category.id}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    fun_category.refresh_from_db()
    assert fun_category.name == data["name"]
    assert fun_category.hex_color == data["hex_color"]
    assert not fun_category.deleted

    assert not Expense.objects.filter(category="Casa").exists()
    assert Expense.objects.filter(category=data["name"], expanded_category=fun_category).exists()

    house_category.refresh_from_db()
    assert house_category.deleted


def test__update__categories__validate_unique_name(client):
    # GIVEN
    category = ExpenseCategory.objects.get(name="Casa")
    data = {"name": "Lazer", "hex_color": Colors.orange1}

    # WHEN
    response = client.put(f"{URL}/categories/{category.id}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {"name": "Os nomes precisam ser únicos"}


def test__update__categories__validate_color(client):
    # GIVEN
    category = ExpenseCategory.objects.get(name="Casa")
    data = {"name": "name", "hex_color": "#4287f5"}

    # WHEN
    response = client.put(f"{URL}/categories/{category.id}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {
        "hex_color": ["Select a valid choice. #4287f5 is not one of the available choices."]
    }


def test__delete__categories__e2e_update(client, expense, bank_account):
    # GIVEN
    update_data = {
        "value": expense.value + 10,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/10/2024",
        "source": MONEY_SOURCE,
        "bank_account_description": bank_account.description,
    }
    category = ExpenseCategory.objects.get(name="Casa")

    # WHEN
    response = client.delete(f"{URL}/categories/{category.id}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    assert ExpenseCategory.objects.filter(id=category.id, deleted=True).exists()

    response = client.put(f"{URL}/{expense.id}", data=update_data)
    assert response.status_code == HTTP_200_OK

    expense.refresh_from_db()
    assert expense.category == update_data["category"]


def test__delete__categories__e2e_list(client, expense):
    # GIVEN
    category = ExpenseCategory.objects.get(name="Casa")

    # WHEN
    response = client.delete(f"{URL}/categories/{category.id}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    assert ExpenseCategory.objects.filter(id=category.id, deleted=True).exists()

    response = client.get(URL)
    assert response.status_code == HTTP_200_OK

    expense.refresh_from_db()
    assert expense.category == "Casa"


def test__delete__categories__e2e_delete(client, expense):
    # GIVEN
    category = ExpenseCategory.objects.get(name="Casa")

    # WHEN
    response = client.delete(f"{URL}/categories/{category.id}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    assert ExpenseCategory.objects.filter(id=category.id, deleted=True).exists()

    response = client.delete(f"{URL}/{expense.id}")
    assert response.status_code == HTTP_204_NO_CONTENT

    assert not Expense.objects.filter(id=expense.id).exists()


def test__list__sources(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/sources")

    # THEN
    assert response.status_code == HTTP_200_OK

    assert sorted(
        _remove_key_from_dicts(response.json()["results"], "id"), key=lambda r: r["name"]
    ) == sorted(
        [{"name": category, "hex_color": color} for category, color in DEFAULT_SOURCES_MAP.items()],
        key=lambda r: r["name"],
    )


@pytest.mark.parametrize("direction", ("asc", "desc"))
@pytest.mark.usefixtures("expense", "another_expense", "yet_another_expense")
def test__list__sources__most_common_ordering(client, direction):
    # GIVEN
    credit_card_source = ExpenseSource.objects.values("id", "name", "hex_color").get(
        name=CREDIT_CARD_SOURCE
    )
    money_source = ExpenseSource.objects.values("id", "name", "hex_color").get(name=MONEY_SOURCE)
    expected = [money_source, credit_card_source]
    if direction == "desc":
        expected = list(reversed(expected))

    # WHEN
    response = client.get(
        f"{URL}/sources?page_size=10&ordering={'-' if direction == 'desc' else ''}"
        "num_of_appearances"
    )

    # THEN
    assert response.json()["results"] == expected


@pytest.mark.usefixtures("expense", "another_expense", "yet_another_expense")
def test__most_common__sources(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/sources/most_common")

    # THEN
    assert response.status_code == HTTP_200_OK

    assert _remove_key_from_dict(response.json(), "id") == {
        "name": CREDIT_CARD_SOURCE,
        "hex_color": DEFAULT_SOURCES_MAP[CREDIT_CARD_SOURCE],
    }


def test__create__sources(client, user):
    # GIVEN
    data = {"name": "name", "hex_color": Colors.orange1}

    # WHEN
    response = client.post(f"{URL}/sources", data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert ExpenseSource.objects.filter(user=user, **data).exists()


def test__create__sources__validate_unique_name(client):
    # GIVEN
    data = {"name": CREDIT_CARD_SOURCE, "hex_color": Colors.orange1}

    # WHEN
    response = client.post(f"{URL}/sources", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {"name": "Os nomes precisam ser únicos"}


def test__create__sources__undo_soft_delete(client, user, default_sources):
    # GIVEN
    data = {"name": MONEY_SOURCE, "hex_color": Colors.orange1}
    money_source = next(s for s in default_sources if s.name == data["name"])
    money_source.deleted = True
    money_source.save()

    # WHEN
    response = client.post(f"{URL}/sources", data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert ExpenseSource.objects.filter(user=user, deleted=False, **data).exists()


def test__create__sources__validate_color(client):
    # GIVEN
    data = {"name": "name", "hex_color": "#4287f5"}

    # WHEN
    response = client.post(f"{URL}/sources", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {
        "hex_color": ["Select a valid choice. #4287f5 is not one of the available choices."]
    }


@pytest.mark.usefixtures("fixed_expenses", "yet_another_expense")
def test__update__sources(client):
    # GIVEN
    source = ExpenseSource.objects.get(name=CREDIT_CARD_SOURCE)
    data = {"name": "name", "hex_color": Colors.orange1}

    # WHEN
    response = client.put(f"{URL}/sources/{source.id}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    source.refresh_from_db()
    assert source.name == data["name"]
    assert source.hex_color == data["hex_color"]

    assert not Expense.objects.filter(source=CREDIT_CARD_SOURCE).exists()
    assert Expense.objects.filter(source=data["name"], expanded_source=source).exists()


@pytest.mark.usefixtures("fixed_expenses", "yet_another_expense")
def test__update__sources__undo_soft_delete(client, user, default_sources):
    # GIVEN
    data = {"name": CREDIT_CARD_SOURCE, "hex_color": Colors.orange1}
    credit_card_source: ExpenseSource = next(c for c in default_sources if c.name == data["name"])
    credit_card_source.deleted = True
    credit_card_source.save()

    money_source: ExpenseSource = next(c for c in default_sources if c.name == MONEY_SOURCE)

    # WHEN
    response = client.put(f"{URL}/sources/{money_source.id}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    credit_card_source.refresh_from_db()
    assert credit_card_source.name == data["name"]
    assert credit_card_source.hex_color == data["hex_color"]
    assert not credit_card_source.deleted

    assert not Expense.objects.filter(source=MONEY_SOURCE).exists()
    assert Expense.objects.filter(source=data["name"], expanded_source=credit_card_source).exists()

    money_source.refresh_from_db()
    assert money_source.deleted


def test__update__sources__validate_unique_name(client):
    # GIVEN
    source = ExpenseSource.objects.get(name=CREDIT_CARD_SOURCE)
    data = {"name": MONEY_SOURCE, "hex_color": Colors.orange1}

    # WHEN
    response = client.put(f"{URL}/sources/{source.id}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {"name": "Os nomes precisam ser únicos"}


def test__update__sources__validate_color(client):
    # GIVEN
    source = ExpenseSource.objects.get(name=CREDIT_CARD_SOURCE)
    data = {"name": "name", "hex_color": "#4287f5"}

    # WHEN
    response = client.put(f"{URL}/sources/{source.id}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {
        "hex_color": ["Select a valid choice. #4287f5 is not one of the available choices."]
    }


def test__delete__sources__e2e_update(client, expense, bank_account):
    # GIVEN
    update_data = {
        "value": expense.value + 10,
        "description": "Test",
        "category": "Casa",
        "created_at": "01/10/2024",
        "source": CREDIT_CARD_SOURCE,
        "bank_account_description": bank_account.description,
    }
    source = ExpenseSource.objects.get(name=CREDIT_CARD_SOURCE)

    # WHEN
    response = client.delete(f"{URL}/sources/{source.id}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    assert ExpenseSource.objects.filter(id=source.id, deleted=True).exists()

    response = client.put(f"{URL}/{expense.id}", data=update_data)
    assert response.status_code == HTTP_200_OK

    expense.refresh_from_db()
    assert expense.source == update_data["source"]


def test__delete__sources__e2e_list(client, expense):
    # GIVEN
    source = ExpenseSource.objects.get(name=CREDIT_CARD_SOURCE)

    # WHEN
    response = client.delete(f"{URL}/sources/{source.id}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    assert ExpenseSource.objects.filter(id=source.id, deleted=True).exists()

    response = client.get(URL)
    assert response.status_code == HTTP_200_OK

    expense.refresh_from_db()
    assert expense.source == CREDIT_CARD_SOURCE


def test__delete__sources__e2e_delete(client, expense):
    # GIVEN
    source = ExpenseSource.objects.get(name=CREDIT_CARD_SOURCE)

    # WHEN
    response = client.delete(f"{URL}/sources/{source.id}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    assert ExpenseSource.objects.filter(id=source.id, deleted=True).exists()

    response = client.delete(f"{URL}/{expense.id}")
    assert response.status_code == HTTP_204_NO_CONTENT

    assert not Expense.objects.filter(id=expense.id).exists()
