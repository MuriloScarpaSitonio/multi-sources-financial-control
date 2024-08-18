from statistics import fmean

from django.utils import timezone

import pytest
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST

from config.settings.base import BASE_API_URL
from shared.tests import convert_and_quantitize, convert_to_percentage_and_quantitize

from ...choices import ExpenseCategory, ExpenseReportType, ExpenseSource
from ...models import Expense

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "expenses"


def test__report__wo_group_by(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/avg_comparasion_report?period=since_a_year_ago")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"group_by": ["This field is required."]}


def test__report__invalid_group_by(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/avg_comparasion_report?group_by=wrong&period=since_a_year_ago")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "group_by": ["Select a valid choice. wrong is not one of the available choices."]
    }


def test__report__wo_period(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/avg_comparasion_report?group_by=type")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"period": ["This field is required."]}


def test__report__invalid_period(client):
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
def test__reports(client, group_by, field_name):
    # GIVEN
    choices_class_map = {"category": ExpenseCategory, "source": ExpenseSource}
    choices_class = choices_class_map.get(field_name)
    qs = Expense.objects.since_a_year_ago()
    today = timezone.localdate()
    current_month = {}
    since_a_year_ago = {}
    for e in qs:
        f = (
            choices_class.get_choice(getattr(e, field_name)).label
            if choices_class is not None
            else field_name
        )
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
def test__report__wo_data(client, group_by):
    # GIVEN

    # WHEN
    response = client.get(
        f"{URL}/avg_comparasion_report?group_by={group_by}&period=since_a_year_ago"
    )

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == []


@pytest.mark.usefixtures("expenses_report_data")
@pytest.mark.parametrize(
    "group_by, field_name",
    [(value, ExpenseReportType.get_choice(value).field_name) for value in ExpenseReportType.values],
)
def test__report__current_month_and_past_period(client, group_by, field_name):
    # GIVEN
    choices_class_map = {"category": ExpenseCategory, "source": ExpenseSource}
    choices_class = choices_class_map.get(field_name)
    qs = Expense.objects.current_month_and_past()
    today = timezone.localdate()
    current_month = {}
    past = {}
    for e in qs:
        f = (
            choices_class.get_choice(getattr(e, field_name)).label
            if choices_class is not None
            else field_name
        )
        if e.created_at.month == today.month and e.created_at.year == today.year:
            current_month.setdefault(f, []).append(e.value)
        else:
            past.setdefault(f, []).append(e.value)
    result_brute_force = [
        {
            "total": sum(current_month.get(k)) if current_month.get(k) is not None else 0,
            "avg": convert_and_quantitize(fmean(v)),
            field_name: k,
        }
        for k, v in past.items()
    ]

    # WHEN
    response = client.get(
        f"{URL}/avg_comparasion_report?group_by={group_by}&period=current_month_and_past"
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


def test__reports__percentage__wo_group_by(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/avg_comparasion_report?period=since_a_year_ago")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"group_by": ["This field is required."]}


def test__reports__percentage__invalid_group_by(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/percentage_report?group_by=wrong&period=since_a_year_ago")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "group_by": ["Select a valid choice. wrong is not one of the available choices."]
    }


def test__reports__percentage__wo_period(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/percentage_report?group_by=type")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"period": ["This field is required."]}


def test__reports__percentage__invalid_period(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/percentage_report?group_by=type&period=wrong")

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
def test__reports__percentage(client, group_by, field_name):
    # GIVEN
    choices_class_map = {"category": ExpenseCategory, "source": ExpenseSource}
    choices_class = choices_class_map.get(field_name)
    qs = Expense.objects.current_month()
    total = qs.sum()["total"]

    if choices_class:
        totals = {v: qs.filter(**{field_name: v}).sum()["total"] for v in choices_class.values}
    else:
        totals = {
            "Variável": qs.filter(is_fixed=False).sum()["total"],
            "Fixo": qs.filter(is_fixed=True).sum()["total"],
        }
    # WHEN
    response = client.get(f"{URL}/percentage_report?group_by={group_by}&period=current")

    # THEN
    for result in response.json():
        if choices_class:
            for choice, label in choices_class.choices:
                if label == result[group_by]:
                    assert float(
                        convert_to_percentage_and_quantitize(value=totals[choice], total=total)
                    ) == convert_and_quantitize(result["total"])
        else:
            for label, value in totals.items():
                if label == result[group_by]:
                    assert float(
                        convert_to_percentage_and_quantitize(value=value, total=total)
                    ) == convert_and_quantitize(result["total"])
    assert response.status_code == HTTP_200_OK


@pytest.mark.usefixtures("expenses_report_data")
@pytest.mark.parametrize(
    "group_by, field_name",
    [(value, ExpenseReportType.get_choice(value).field_name) for value in ExpenseReportType.values],
)
def test__reports__percentage__current_month_and_past(client, group_by, field_name):
    # GIVEN
    choices_class_map = {"category": ExpenseCategory, "source": ExpenseSource}
    choices_class = choices_class_map.get(field_name)
    qs = Expense.objects.current_month_and_past()
    total = qs.sum()["total"]

    if choices_class:
        totals = {v: qs.filter(**{field_name: v}).sum()["total"] for v in choices_class.values}
    else:
        totals = {
            "Variável": qs.filter(is_fixed=False).sum()["total"],
            "Fixo": qs.filter(is_fixed=True).sum()["total"],
        }
    # WHEN
    response = client.get(
        f"{URL}/percentage_report?group_by={group_by}&period=current_month_and_past"
    )

    # THEN
    for result in response.json():
        if choices_class:
            for choice, label in choices_class.choices:
                if label == result[group_by]:
                    assert float(
                        convert_to_percentage_and_quantitize(value=totals[choice], total=total)
                    ) == convert_and_quantitize(result["total"])
        else:
            for label, value in totals.items():
                if label == result[group_by]:
                    assert float(
                        convert_to_percentage_and_quantitize(value=value, total=total)
                    ) == convert_and_quantitize(result["total"])
    assert response.status_code == HTTP_200_OK


@pytest.mark.usefixtures("expenses_report_data")
@pytest.mark.parametrize(
    "group_by, field_name",
    [(value, ExpenseReportType.get_choice(value).field_name) for value in ExpenseReportType.values],
)
def test__reports__percentage__since_a_year_ago(client, group_by, field_name):
    # GIVEN
    choices_class_map = {"category": ExpenseCategory, "source": ExpenseSource}
    choices_class = choices_class_map.get(field_name)
    qs = Expense.objects.since_a_year_ago()
    total = qs.sum()["total"]

    if choices_class:
        totals = {v: qs.filter(**{field_name: v}).sum()["total"] for v in choices_class.values}
    else:
        totals = {
            "Variável": qs.filter(is_fixed=False).sum()["total"],
            "Fixo": qs.filter(is_fixed=True).sum()["total"],
        }
    # WHEN
    response = client.get(f"{URL}/percentage_report?group_by={group_by}&period=since_a_year_ago")

    # THEN
    for result in response.json():
        if choices_class:
            for choice, label in choices_class.choices:
                if label == result[group_by]:
                    assert float(
                        convert_to_percentage_and_quantitize(value=totals[choice], total=total)
                    ) == convert_and_quantitize(result["total"])
        else:
            for label, value in totals.items():
                if label == result[group_by]:
                    assert float(
                        convert_to_percentage_and_quantitize(value=value, total=total)
                    ) == convert_and_quantitize(result["total"])
    assert response.status_code == HTTP_200_OK
