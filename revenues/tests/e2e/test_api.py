from datetime import date, datetime
from decimal import Decimal

import pytest

from bson import Decimal128
from dateutil import relativedelta

from src.settings import COLLECTION_NAME, DATABASE_NAME, SECRET_KEY


def test_get_revenue(client, revenue, mongo_session):
    # GIVEN
    rev = mongo_session._client[DATABASE_NAME][COLLECTION_NAME].find_one({"_id": revenue.id})

    # WHEN
    response = client.get(f"/revenues/{revenue.id}")
    response_json = response.json()

    # THEN
    assert response.status_code == 200
    assert sorted(response_json.keys()) == ["_id", "created_at", "description", "value"]
    assert response_json["created_at"] == str(rev["created_at"].date())
    assert response_json["description"] == rev["description"]
    assert Decimal(response_json["value"]) == rev["value"].to_decimal()


def test_should_raise_404_get_revenue_not_found(client):
    # GIVEN

    # WHEN
    response = client.get("/revenues/62707d8ddab7d67bc190e9ca")

    # THEN
    assert response.status_code == 404


@pytest.mark.usefixtures("revenues")
def test_list_revenues(client):
    # GIVEN

    # WHEN
    response = client.get("/revenues")
    response_json = response.json()

    # THEN
    assert response.status_code == 200
    assert len(response_json["items"]) == response_json["total"] == 2
    assert response_json["page"] == 1


@pytest.mark.usefixtures("revenues")
def test_list_revenues_w_filters(client):
    # GIVEN

    # WHEN
    response = client.get("/revenues?description=Revenue 01")
    response_json = response.json()

    # THEN
    assert response.status_code == 200
    assert len(response_json["items"]) == response_json["total"] == 1
    assert response_json["page"] == 1


@pytest.mark.usefixtures("revenues")
def test_list_revenues_with_empty_string_as_query_param(client):
    # GIVEN

    # WHEN
    response = client.get("/revenues?start_date=&end_date=")
    response_json = response.json()

    # THEN
    assert response.status_code == 200
    assert len(response_json["items"]) == response_json["total"] == 2
    assert response_json["page"] == 1


def test_delete_revenue(client, revenue):
    # GIVEN

    # WHEN
    response = client.delete(f"/revenues/{revenue.id}")

    # THEN
    assert response.status_code == 204


def test_should_raise_404_delete_revenue_not_found(client):
    # GIVEN

    # WHEN
    response = client.delete("/revenues/62707d8ddab7d67bc190e9ca")

    # THEN
    assert response.status_code == 404


@pytest.mark.usefixtures("revenues")
def test_revenues_historic(client, mongo_session):
    # GIVEN
    today = date.today()
    total = (
        mongo_session._client[DATABASE_NAME][COLLECTION_NAME]
        .aggregate(
            [
                {"$group": {"_id": None, "total": {"$sum": "$value"}}},
                {"$project": {"_id": 0, "total": 1}},
            ],
        )
        .next()
    )["total"]

    # WHEN
    response = client.get("/revenues/reports/historic")
    historic = response.json()["historic"]

    # THEN
    assert response.status_code == 200
    assert len(historic) == 1
    assert sorted(historic[0].keys()) == ["date", "total"]
    assert historic[0]["date"] == f"{today.month}/{today.year}"
    assert str(historic[0]["total"]) == str(total)
    assert response.json()["avg"] == sum((h["total"] for h in historic[:-1])) / len(historic)


@pytest.mark.usefixtures("historic_data")
def test__historic_w_missing_revenues(client, mongo_session):
    # GIVEN

    # WHEN
    response = client.get("/revenues/reports/historic")
    for r in response.json()["historic"]:
        print(r)

    # THEN
    for historic in response.json()["historic"]:
        d = datetime.strptime(historic["date"], "%m/%Y")
        total = (
            mongo_session._client[DATABASE_NAME][COLLECTION_NAME]
            .aggregate(
                [
                    {
                        "$match": {
                            "created_at": {
                                "$gte": d,
                                "$lt": d + relativedelta.relativedelta(months=1),
                            }
                        }
                    },
                    {"$group": {"_id": None, "total": {"$sum": "$value"}}},
                    {"$project": {"_id": 0, "total": 1}},
                ],
            )
            .next()
        )["total"]

        assert historic["total"] == (total.to_decimal() if isinstance(total, Decimal128) else total)


@pytest.mark.usefixtures("revenues")
def test_revenues_indicators(client, mongo_session):
    # GIVEN
    today = date.today()
    total = (
        mongo_session._client[DATABASE_NAME][COLLECTION_NAME]
        .aggregate(
            [
                {"$group": {"_id": None, "total": {"$sum": "$value"}}},
                {"$project": {"_id": 0, "total": 1}},
            ],
        )
        .next()
    )["total"]

    # WHEN
    response = client.get("/revenues/reports/indicators")
    response_json = response.json()

    # THEN
    assert response.status_code == 200
    assert sorted(response_json.keys()) == ["avg", "diff", "month", "total", "year"]
    assert str(response_json["avg"]) == str(response_json["total"]) == str(total)
    assert response_json["diff"] == 0
    assert response_json["month"] == today.month
    assert response_json["year"] == today.year


def test_create_revenue(client, mocker):
    # GIVEN
    mock_send_mail = mocker.patch("src.service_layer.handlers.send_email")
    mock_agilize_client = mocker.patch("src.service_layer.handlers.agilize_client")

    # WHEN
    response = client.post(
        "/revenues",
        json={"description": "Revenue 01", "value": 1.0, "created_at": str(date.today())},
    )

    # THEN
    assert response.status_code == 202
    assert mock_send_mail.call_count == 1
    assert mock_agilize_client.post.call_count == 1


def test_update_revenue(client, revenue):
    # GIVEN
    data = {"description": "Revenue 01", "value": 10, "created_at": str(date.today())}

    # WHEN
    response = client.patch(f"/revenues/{revenue.id}", json=data)
    response_json = response.json()

    # THEN
    assert response.status_code == 200
    assert sorted(response_json.keys()) == ["_id", "created_at", "description", "value"]
    assert response_json["created_at"] == data["created_at"]
    assert response_json["description"] == data["description"]
    assert response_json["value"] == data["value"]


def test_should_raise_404_update_revenue_not_found(client):
    # GIVEN

    # WHEN
    response = client.patch(
        "/revenues/62707d8ddab7d67bc190e9ca",
        json={"description": "", "value": 0, "created_at": "2000-01-01"},
    )

    # THEN
    assert response.status_code == 404


def test_should_fail_wo_headers(_client):
    # GIVEN

    # WHEN
    response = _client.get("/revenues")

    # THEN
    assert response.status_code == 422
    assert response.json() == {
        "detail": [
            {"loc": ["header", "x-key"], "msg": "field required", "type": "value_error.missing"},
            {"loc": ["header", "user-id"], "msg": "field required", "type": "value_error.missing"},
        ]
    }


def test_should_fail_wo_user_id(_client):
    # GIVEN

    # WHEN
    response = _client.get("/revenues", headers={"x-key": SECRET_KEY})

    # THEN
    assert response.status_code == 422
    assert response.json() == {
        "detail": [
            {"loc": ["header", "user-id"], "msg": "field required", "type": "value_error.missing"},
        ]
    }


def test_should_fail_wo_key(_client):
    # GIVEN

    # WHEN
    response = _client.get("/revenues", headers={"user-id": "1"})

    # THEN
    assert response.status_code == 422
    assert response.json() == {
        "detail": [
            {"loc": ["header", "x-key"], "msg": "field required", "type": "value_error.missing"},
        ]
    }


def test_should_fail_w_wrong_key(_client):
    # GIVEN

    # WHEN
    response = _client.get("/revenues", headers={"x-key": "wrong"})

    # THEN
    assert response.status_code == 400
    assert response.json() == {"detail": "X-Key header invalid"}
