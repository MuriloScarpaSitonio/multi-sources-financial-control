from datetime import date
from uuid import uuid4

from django.db import connection
from django.test.utils import CaptureQueriesContext

import pytest

from authentication.tests.conftest import IntegrationSecretFactory, UserFactory
from expenses.choices import CREDIT_CARD_SOURCE
from expenses.models import Expense, Revenue
from expenses.tests.conftest import BankAccountFactory, ExpenseFactory, RevenueFactory

pytestmark = pytest.mark.django_db


@pytest.fixture(params=["expenses", "revenues"])
def search_rows(request, user, bank_account):
    resource = request.param
    factory = ExpenseFactory if resource == "expenses" else RevenueFactory
    common = {"user": user, "bank_account": bank_account, "value": 50, "category": "Casa"}
    if resource == "expenses":
        common["source"] = CREDIT_CARD_SOURCE
    rows = {
        label: factory(description=description, created_at=created_at, **common)
        for label, description, created_at in [
            ("a", "Compra no supermercado", date(2020, 1, 15)),
            ("b", "Supermercado !!!", date(2030, 2, 1)),
            ("c", "Compra em mercado", date(2026, 10, 1)),
        ]
    }
    other_user = UserFactory(
        email="search-other@example.com",
        username="search-other",
        secrets=IntegrationSecretFactory(cpf="52245911040"),
    )
    other_bank = BankAccountFactory(user=other_user, description="Other", amount=100)
    factory(
        **{**common, "user": other_user, "bank_account": other_bank},
        description="Compra no supermercado",
        created_at=date(2020, 1, 15),
    )
    return resource, rows


@pytest.mark.parametrize(
    "query,labels",
    [
        ("super", {"a", "b"}),
        ("super comp", {"a"}),
        ("comp super", {"a"}),
        ("SUPER COMP", {"a"}),
        ("mercado", {"c"}),
        ("super wrong", set()),
        ("super !!!", {"a", "b"}),
        ("!!!", set()),
        ("", {"a", "b", "c"}),
        (None, {"a", "b", "c"}),
        ("   ", set()),
    ],
)
def test_native_word_prefix_matching(client, search_rows, query, labels):
    resource, rows = search_rows
    params = {"page_size": 100}
    if query is not None:
        params["description"] = query
    response = client.get(f"/api/v1/{resource}", params)
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == len(labels)
    assert {row["id"] for row in data["results"]} == {rows[label].pk for label in labels}


@pytest.mark.parametrize("query,labels", [("super | wrong", set()), ("super ! comp", {"a"})])
def test_operator_like_input_is_data(client, search_rows, query, labels):
    resource, rows = search_rows
    response = client.get(f"/api/v1/{resource}", {"description": query})
    assert response.status_code == 200
    assert {row["id"] for row in response.json()["results"]} == {rows[label].pk for label in labels}


@pytest.mark.parametrize("query", ["super' comp", r"super\ comp", "'", "\\"])
def test_escaped_input_is_safe_and_user_scoped(client, search_rows, query):
    resource, rows = search_rows
    response = client.get(f"/api/v1/{resource}", {"description": query})
    assert response.status_code == 200
    assert {row["id"] for row in response.json()["results"]} <= {row.pk for row in rows.values()}


@pytest.mark.parametrize(
    "bounds,labels",
    [
        ({"start_date": "2026-01-01"}, {"b"}),
        ({"end_date": "31/12/2020"}, {"a"}),
        ({"start_date": "2021-01-01", "end_date": "2029-12-31"}, set()),
    ],
)
def test_description_with_existing_date_and_bank_filters(client, search_rows, bounds, labels):
    resource, rows = search_rows
    response = client.get(
        f"/api/v1/{resource}",
        {
            "description": "super",
            "bank_account_description": "Nubank",
            **bounds,
        },
    )
    assert response.status_code == 200
    assert {row["id"] for row in response.json()["results"]} == {rows[label].pk for label in labels}


def test_description_with_existing_expense_entity_filters(client, expense_w_tags):
    expense_w_tags.description = "Compra no supermercado"
    expense_w_tags.save()
    params = {
        "description": "super comp",
        "category": ["Casa"],
        "source": [CREDIT_CARD_SOURCE],
        "tag": ["abc"],
    }
    response = client.get("/api/v1/expenses", params)
    assert response.status_code == 200
    assert [row["id"] for row in response.json()["results"]] == [expense_w_tags.pk]
    assert client.get("/api/v1/expenses", {**params, "tag": ["wrong"]}).json()["count"] == 0


@pytest.mark.parametrize("resource", ["expenses", "revenues"])
def test_all_kinds_are_paginated(client, user, bank_account, resource):
    model = Expense if resource == "expenses" else Revenue
    rows = []
    for kind in (
        ["ordinary", "fixed", "installment"] if resource == "expenses" else ["ordinary", "fixed"]
    ):
        for _ in range(101):
            fields = {
                "user": user,
                "bank_account": bank_account,
                "value": 50,
                "category": "Casa",
                "description": "Pagination supermarket",
                "created_at": date(2026, 10, 1),
                "is_fixed": kind == "fixed",
            }
            if resource == "expenses":
                fields["source"] = CREDIT_CARD_SOURCE
                if kind == "installment":
                    fields.update(installments_id=uuid4(), installment_number=1, installments_qty=2)
            rows.append(model(**fields))
    model.objects.bulk_create(rows)
    expected = list(
        model.objects.filter(user=user).order_by("-created_at", "-id").values_list("id", flat=True)
    )
    found = []
    for page in range(1, (len(expected) + 99) // 100 + 1):
        response = client.get(
            f"/api/v1/{resource}",
            {
                "description": "pag super",
                "ordering": "-created_at,-id",
                "page_size": 100,
                "page": page,
            },
        )
        assert response.status_code == 200
        assert response.json()["count"] == (303 if resource == "expenses" else 202)
        found.extend(row["id"] for row in response.json()["results"])
    assert found == expected
    response = client.get(
        f"/api/v1/{resource}",
        {
            "description": "pag super",
            "ordering": "value,-id",
            "page_size": 100,
        },
    )
    assert [row["id"] for row in response.json()["results"]] == expected[:100]


def test_installment_metadata_is_read_only(client, expense, expenses_w_installments):
    response = client.get("/api/v1/expenses", {"page_size": 100})
    rows = {row["id"]: row for row in response.json()["results"]}
    assert [
        rows[expense.pk][field]
        for field in ["installments_id", "installment_number", "installments_qty"]
    ] == [None, None, None]
    installment = expenses_w_installments[0]
    row = rows[installment.pk]
    assert row["installments_id"] == str(installment.installments_id)
    assert row["installment_number"] == 1
    assert row["installments_qty"] == 5
    payload = {
        key: row[key]
        for key in [
            "description",
            "value",
            "category",
            "source",
            "created_at",
            "is_fixed",
            "tags",
            "bank_account_description",
        ]
    }
    payload.update(installments_id=str(uuid4()), installment_number=99, installments_qty=99)
    payload["created_at"] = installment.created_at.strftime("%d/%m/%Y")
    response = client.put(f"/api/v1/expenses/{installment.pk}", payload)
    assert response.status_code == 200
    installment.refresh_from_db()
    assert installment.installment_number == 1
    assert installment.installments_qty == 5
    assert response.json()["installments_id"] == str(installment.installments_id)
    assert response.json()["installment_number"] == 1
    assert response.json()["installments_qty"] == 5


@pytest.mark.parametrize("installments", [1, 2])
def test_created_expense_metadata_uses_persisted_installments(client, bank_account, installments):
    response = client.post(
        "/api/v1/expenses",
        {
            "description": "Metadata",
            "value": 100,
            "category": "Casa",
            "source": CREDIT_CARD_SOURCE,
            "created_at": "07/10/2026",
            "is_fixed": False,
            "bank_account_description": bank_account.description,
            "installments": installments,
        },
    )
    assert response.status_code == 201
    data = response.json()
    expense = Expense.objects.get(
        description="Metadata", installment_number=1 if installments > 1 else None
    )
    assert data["installments_id"] == (
        str(expense.installments_id) if expense.installments_id else None
    )
    assert data["installment_number"] == expense.installment_number
    assert data["installments_qty"] == expense.installments_qty
    assert "installments" not in data


def test_description_indexes_match_query_expression(client, search_rows, user, bank_account):
    resource, _ = search_rows
    model = Expense if resource == "expenses" else Revenue
    extra = {"source": CREDIT_CARD_SOURCE} if resource == "expenses" else {}
    model.objects.bulk_create(
        [
            model(
                user=user,
                bank_account=bank_account,
                value=50,
                category="Casa",
                description="Unrelated purchase",
                created_at=date(2026, 10, 1),
                **extra,
            )
            for _ in range(2500)
        ]
    )
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN (%s, %s)",
            ["expenses_desc_search_gin", "revenues_desc_search_gin"],
        )
        indexes = dict(cursor.fetchall())
        assert set(indexes) == {"expenses_desc_search_gin", "revenues_desc_search_gin"}
        assert all(
            "USING gin" in definition and "'simple'::regconfig" in definition
            for definition in indexes.values()
        )
        cursor.execute(f"ANALYZE {model._meta.db_table}")
    with CaptureQueriesContext(connection) as captured:
        response = client.get(
            f"/api/v1/{resource}",
            {
                "description": "super",
                "ordering": "-created_at,-id",
                "page_size": 100,
            },
        )
    assert response.status_code == 200
    assert response.json()["count"] == 2
    queries = [q["sql"] for q in captured.captured_queries if "@@" in q["sql"]]
    assert len(queries) == 2
    with connection.cursor() as cursor:
        for sql in queries:
            cursor.execute("EXPLAIN (ANALYZE, BUFFERS) " + sql)
            print(
                f"\n{resource}: 2503 owned rows, 2 matches\n"
                + "\n".join(row[0] for row in cursor.fetchall())
            )
