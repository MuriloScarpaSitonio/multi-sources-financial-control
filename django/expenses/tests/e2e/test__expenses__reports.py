from datetime import datetime
from statistics import fmean

from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST

from config.settings.base import BASE_API_URL
from shared.tests import convert_and_quantitize, convert_to_percentage_and_quantitize

from ...choices import (
    CREDIT_CARD_SOURCE,
    DEFAULT_CATEGORIES_MAP,
    DEFAULT_SOURCES_MAP,
    ExpenseReportType,
)
from ...models import Expense

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "expenses"

MAPS = {"category": DEFAULT_CATEGORIES_MAP, "source": DEFAULT_SOURCES_MAP}


def test__avg_comparasion_report__wo_group_by(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/avg_comparasion_report?period=since_a_year_ago")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"group_by": ["This field is required."]}


def test__avg_comparasion_report__invalid_group_by(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/avg_comparasion_report?group_by=wrong&period=since_a_year_ago")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "group_by": ["Select a valid choice. wrong is not one of the available choices."]
    }


def test__avg_comparasion_report__wo_period(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/avg_comparasion_report?group_by=type")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"period": ["This field is required."]}


def test__avg_comparasion_report__invalid_period(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/avg_comparasion_report?group_by=type&period=wrong")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "period": ["Select a valid choice. wrong is not one of the available choices."]
    }


@pytest.mark.usefixtures("expenses_report_data")
@pytest.mark.parametrize(
    "group_by, field_name",
    [(value, ExpenseReportType.get_choice(value).field_name) for value in ExpenseReportType.values],
)
def test__avg_comparasion_report(client, group_by, field_name):
    # GIVEN
    qs = Expense.objects.since_a_year_ago()
    today = timezone.localdate()
    current_month = {}
    since_a_year_ago = {}
    for e in qs:
        f = getattr(e, field_name) if field_name != "is_fixed" else field_name
        if e.created_at.month == today.month and e.created_at.year == today.year:
            current_month.setdefault(f, []).append(e.value)
        else:
            since_a_year_ago.setdefault(f, []).append(e.value)
    result_brute_force = [
        {
            "total": sum(current_month.get(k)) if current_month.get(k) is not None else 0,
            "avg": convert_and_quantitize(fmean(v)),
            field_name: k,
        }
        for k, v in since_a_year_ago.items()
    ]

    # WHEN
    response = client.get(
        f"{URL}/avg_comparasion_report?group_by={group_by}&period=since_a_year_ago"
    )

    # THEN
    for result in response.json():
        for brute_force in result_brute_force:
            if result[field_name] == brute_force[field_name]:
                assert convert_and_quantitize(result["total"]) == convert_and_quantitize(
                    brute_force["total"]
                )
                assert convert_and_quantitize(result["avg"]) == convert_and_quantitize(
                    brute_force["avg"]
                )
    assert response.status_code == HTTP_200_OK


@pytest.mark.parametrize("group_by", list(ExpenseReportType.values))
def test__avg_comparasion_report__wo_data(client, group_by):
    # GIVEN

    # WHEN
    response = client.get(
        f"{URL}/avg_comparasion_report?group_by={group_by}&period=since_a_year_ago"
    )

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == []


def test__reports__percentage__wo_group_by(client):
    # GIVEN
    today = timezone.localdate()
    start_date, end_date = today - relativedelta(months=18), today

    # WHEN
    response = client.get(
        f"{URL}/percentage_report"
        + f"?start_date={start_date.strftime('%d/%m/%Y')}"
        + f"&end_date={end_date.strftime('%d/%m/%Y')}"
    )

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"group_by": ["This field is required."]}


def test__reports__percentage__invalid_group_by(client):
    # GIVEN
    today = timezone.localdate()
    start_date, end_date = today - relativedelta(months=18), today

    # WHEN
    response = client.get(
        f"{URL}/percentage_report?group_by=wrong"
        + f"&start_date={start_date.strftime('%d/%m/%Y')}"
        + f"&end_date={end_date.strftime('%d/%m/%Y')}"
    )

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "group_by": ["Select a valid choice. wrong is not one of the available choices."]
    }


@pytest.mark.usefixtures("expenses_report_data")
@pytest.mark.parametrize(
    "group_by, field_name",
    [(value, ExpenseReportType.get_choice(value).field_name) for value in ExpenseReportType.values],
)
def test__reports__percentage(client, group_by, field_name):
    # GIVEN
    today = timezone.localdate()
    start_date, end_date = today - relativedelta(months=18), today
    _map = MAPS.get(field_name)
    qs = Expense.objects.filter(created_at__range=(start_date, end_date))
    total = qs.sum()["total"]

    if _map:
        totals = {v: qs.filter(**{field_name: v}).sum()["total"] for v in _map}
    else:
        totals = {
            "Variável": qs.filter(is_fixed=False).sum()["total"],
            "Fixo": qs.filter(is_fixed=True).sum()["total"],
        }
    # WHEN
    response = client.get(
        f"{URL}/percentage_report?group_by={group_by}"
        + f"&start_date={start_date.strftime('%d/%m/%Y')}"
        + f"&end_date={end_date.strftime('%d/%m/%Y')}"
    )

    # THEN
    for result in response.json():
        if _map:
            for label in _map:
                if label == result[group_by]:
                    assert float(
                        convert_to_percentage_and_quantitize(value=totals[label], total=total)
                    ) == convert_and_quantitize(result["total"])
        else:
            for label, value in totals.items():
                if label == result[group_by]:
                    assert float(
                        convert_to_percentage_and_quantitize(value=value, total=total)
                    ) == convert_and_quantitize(result["total"])
    assert response.status_code == HTTP_200_OK


@pytest.mark.usefixtures("expenses_report_data")
def test__historic_report(client, user):
    # GIVEN
    today = timezone.localdate().replace(day=12)
    start_date, end_date = today - relativedelta(months=18), today
    last_day_of_month = end_date + relativedelta(day=31)
    Expense.objects.create(
        created_at=last_day_of_month,
        value=12,
        description="last_day_of_month",
        category="Alimentação",
        source=CREDIT_CARD_SOURCE,
        is_fixed=False,
        user=user,
    )
    qs = Expense.objects.filter(
        user_id=user.id,
        created_at__gte=start_date.replace(day=1),
        created_at__lte=last_day_of_month,
    )

    # WHEN
    response = client.get(
        f"{URL}/historic_report?start_date={start_date.strftime('%d/%m/%Y')}"
        + f"&end_date={end_date.strftime('%d/%m/%Y')}"
    )
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
        qs.monthly_avg()["avg"]
    )
