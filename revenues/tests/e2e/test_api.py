from datetime import date
from decimal import Decimal

import pytest


def test_get_revenue(client, revenue, fastapi_sql_session_factory):
    # GIVEN
    new_session = fastapi_sql_session_factory()
    rev = dict(
        new_session.execute(
            'SELECT * FROM "revenues_revenue" WHERE id = :revenue_id',
            dict(revenue_id=revenue.id),
        ).first()
    )

    # WHEN
    response = client.get(f"/revenues/{revenue.id}")
    response_json = response.json()

    # THEN
    assert response.status_code == 200
    assert sorted(response_json.keys()) == ["created_at", "description", "id", "value"]
    assert response_json["created_at"] == rev["created_at"]
    assert response_json["description"] == rev["description"]
    assert Decimal(response_json["value"]) == Decimal(rev["value"])


def test_should_raise_404_get_revenue_not_found(client):
    # GIVEN

    # WHEN
    response = client.get("/revenues/1111111")

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


def test_delete_revenue(client, revenue):
    # GIVEN

    # WHEN
    response = client.delete(f"/revenues/{revenue.id}")

    # THEN
    assert response.status_code == 204


def test_should_raise_404_delete_revenue_not_found(client):
    # GIVEN

    # WHEN
    response = client.delete("/revenues/1111111")

    # THEN
    assert response.status_code == 404


@pytest.mark.usefixtures("revenues")
def test_revenues_historic(client, fastapi_sql_session_factory):
    # GIVEN
    today = date.today()
    new_session = fastapi_sql_session_factory()
    [total] = new_session.execute('SELECT SUM(value) FROM "revenues_revenue"').first()

    # WHEN
    response = client.get("/historic")
    response_json = response.json()

    # THEN
    assert response.status_code == 200
    assert len(response_json) == 1
    assert sorted(response_json[0].keys()) == ["date", "total"]
    assert response_json[0]["date"] == f"{today.month}/{today.year}"
    assert response_json[0]["total"] == total


@pytest.mark.usefixtures("revenues")
def test_revenues_indicators(client, fastapi_sql_session_factory):
    # GIVEN
    today = date.today()
    new_session = fastapi_sql_session_factory()
    [total] = new_session.execute('SELECT SUM(value) FROM "revenues_revenue"').first()

    # WHEN
    response = client.get("/indicators")
    response_json = response.json()

    # THEN
    assert response.status_code == 200
    assert sorted(response_json.keys()) == ["avg", "diff", "month", "total", "year"]
    assert response_json["avg"] == response_json["total"] == total
    assert response_json["diff"] == 0
    assert response_json["month"] == today.month
    assert response_json["year"] == today.year


def test_create_revenue(client, mocker):
    # GIVEN
    mock_send_mail = mocker.patch("src.service_layer.handlers.send_email")
    mock_agilize_client = mocker.patch("src.service_layer.handlers.agilize_client")

    # WHEN
    response = client.post(
        "/revenues/",
        json={"description": "Revenue 01", "value": 1.0, "created_at": str(date.today())},
    )

    # THEN
    assert response.status_code == 204
    assert mock_send_mail.call_count == 1
    assert mock_agilize_client.post.call_count == 1
