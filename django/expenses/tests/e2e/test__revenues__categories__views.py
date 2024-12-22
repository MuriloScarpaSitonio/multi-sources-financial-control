import pytest
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
)

from config.settings.base import BASE_API_URL

from ...choices import (
    DEFAULT_REVENUE_CATEGORIES_MAP,
    Colors,
)
from ...models import Revenue, RevenueCategory

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "revenues/categories"


def _remove_key_from_dict(d: dict, *keys):
    return {k: v for k, v in d.items() if k not in keys}


def _remove_key_from_dicts(lst: list[dict], *keys):
    return [_remove_key_from_dict(d, *keys) for d in lst]


def test__list(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}?page_size=10")

    # THEN
    assert response.status_code == HTTP_200_OK

    assert sorted(
        _remove_key_from_dicts(response.json()["results"], "id"), key=lambda r: r["name"]
    ) == sorted(
        [
            {"name": category, "hex_color": color}
            for category, color in DEFAULT_REVENUE_CATEGORIES_MAP.items()
        ],
        key=lambda r: r["name"],
    )


@pytest.mark.parametrize("direction", ("asc", "desc"))
@pytest.mark.usefixtures("revenue", "another_revenue", "yet_another_revenue")
def test__list__most_common_ordering(client, direction):
    # GIVEN
    salary_category = RevenueCategory.objects.values("id", "name", "hex_color").get(name="Salário")
    bonus_category = RevenueCategory.objects.values("id", "name", "hex_color").get(name="Bônus")
    expected = [bonus_category, salary_category]
    if direction == "desc":
        expected = list(reversed(expected))

    # WHEN
    response = client.get(
        f"{URL}?page_size=10&ordering={'-' if direction == 'desc' else ''}" "num_of_appearances"
    )

    # THEN
    assert response.json()["results"] == expected


@pytest.mark.usefixtures("revenue", "another_revenue", "yet_another_revenue")
def test__most_common(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/most_common")

    # THEN
    assert response.status_code == HTTP_200_OK

    assert _remove_key_from_dict(response.json(), "id") == {
        "name": "Salário",
        "hex_color": DEFAULT_REVENUE_CATEGORIES_MAP["Salário"],
    }


def test__create(client, user):
    # GIVEN
    data = {"name": "name", "hex_color": Colors.orange1}

    # WHEN
    response = client.post(f"{URL}", data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert RevenueCategory.objects.filter(user=user, **data).exists()


def test__create__validate_unique_name(client):
    # GIVEN
    data = {"name": "Bônus", "hex_color": Colors.orange1}

    # WHEN
    response = client.post(f"{URL}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {"name": "Os nomes precisam ser únicos"}


def test__create__validate_color(client):
    # GIVEN
    data = {"name": "name", "hex_color": "#4287f5"}

    # WHEN
    response = client.post(f"{URL}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {
        "hex_color": ["Select a valid choice. #4287f5 is not one of the available choices."]
    }


@pytest.mark.usefixtures("fixed_revenues", "yet_another_revenue")
def test__update(client):
    # GIVEN
    category = RevenueCategory.objects.get(name="Salário")
    data = {"name": "name", "hex_color": Colors.orange1}

    # WHEN
    response = client.put(f"{URL}/{category.id}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    category.refresh_from_db()
    assert category.name == data["name"]
    assert category.hex_color == data["hex_color"]

    assert not Revenue.objects.filter(category="Salário").exists()
    assert Revenue.objects.filter(category=data["name"], expanded_category=category).exists()


def test__update__validate_unique_name(client):
    # GIVEN
    category = RevenueCategory.objects.get(name="Salário")
    data = {"name": "Bônus", "hex_color": Colors.orange1}

    # WHEN
    response = client.put(f"{URL}/{category.id}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {"name": "Os nomes precisam ser únicos"}


def test__update__validate_color(client):
    # GIVEN
    category = RevenueCategory.objects.get(name="Salário")
    data = {"name": "name", "hex_color": "#4287f5"}

    # WHEN
    response = client.put(f"{URL}/{category.id}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {
        "hex_color": ["Select a valid choice. #4287f5 is not one of the available choices."]
    }


def test__delete__e2e_update(client, revenue):
    # GIVEN
    update_data = {
        "value": revenue.value + 10,
        "description": "Test",
        "category": "Salário",
        "created_at": "01/10/2024",
    }
    category = RevenueCategory.objects.get(name="Salário")

    # WHEN
    response = client.delete(f"{URL}/{category.id}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    assert RevenueCategory.objects.filter(id=category.id, deleted=True).exists()

    response = client.put(f"{URL.replace('/categories', '')}/{revenue.id}", data=update_data)
    assert response.status_code == HTTP_200_OK

    revenue.refresh_from_db()
    assert revenue.category == update_data["category"]


def test__delete__e2e_list(client, revenue):
    # GIVEN
    category = RevenueCategory.objects.get(name="Salário")

    # WHEN
    response = client.delete(f"{URL}/{category.id}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    assert RevenueCategory.objects.filter(id=category.id, deleted=True).exists()

    response = client.get(URL)
    assert response.status_code == HTTP_200_OK

    revenue.refresh_from_db()
    assert revenue.category == "Salário"


def test__delete__e2e_delete(client, revenue):
    # GIVEN
    category = RevenueCategory.objects.get(name="Salário")

    # WHEN
    response = client.delete(f"{URL}/{category.id}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    assert RevenueCategory.objects.filter(id=category.id, deleted=True).exists()

    response = client.delete(f"{URL.replace('/categories', '')}/{revenue.id}")
    assert response.status_code == HTTP_204_NO_CONTENT

    assert not Revenue.objects.filter(id=revenue.id).exists()
