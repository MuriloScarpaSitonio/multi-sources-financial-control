import pytest
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST

from config.settings.base import BASE_API_URL
from shared.tests import convert_and_quantitize, convert_to_percentage_and_quantitize

from ...choices import AssetObjectives, AssetSectors, AssetTypes
from ...models import Asset, AssetReadModel
from ...tests.shared import (
    get_current_roi_brute_force,
    get_current_total_invested_brute_force,
    get_roi_brute_force,
    get_total_invested_brute_force,
)

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets"


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
@pytest.mark.parametrize(
    "group_by, choices_class",
    (("type", AssetTypes), ("sector", AssetSectors), ("objective", AssetObjectives)),
)
def test__total_invested_report(client, group_by, choices_class):
    # GIVEN
    field = "metadata__sector" if group_by == "sector" else group_by
    totals = {
        v: sum(
            get_total_invested_brute_force(Asset.objects.get(pk=asset.write_model_pk))
            for asset in AssetReadModel.objects.filter(**{field: v})
        )
        for v in choices_class.values
    }

    # WHEN
    response = client.get(
        f"{URL}/reports?kind=total_invested&percentage=false&current=false&group_by={group_by}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    for result in response.json():
        for choice, label in choices_class.choices:
            if label == result[group_by]:
                assert convert_and_quantitize(totals[choice]) == result["total"]


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
@pytest.mark.parametrize(
    "group_by, choices_class",
    (("type", AssetTypes), ("sector", AssetSectors), ("objective", AssetObjectives)),
)
def test__total_invested_report__percentage(client, group_by, choices_class):
    # GIVEN
    total_invested = sum(get_total_invested_brute_force(asset) for asset in Asset.objects.all())
    field = "metadata__sector" if group_by == "sector" else group_by
    totals = {
        v: sum(
            get_total_invested_brute_force(Asset.objects.get(pk=asset.write_model_pk))
            for asset in AssetReadModel.objects.filter(**{field: v})
        )
        for v in choices_class.values
    }

    # WHEN
    response = client.get(
        f"{URL}/reports?kind=total_invested&percentage=true&current=false&group_by={group_by}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    for result in response.json():
        for choice, label in choices_class.choices:
            if label == result[group_by]:
                assert float(
                    convert_to_percentage_and_quantitize(value=totals[choice], total=total_invested)
                ) == convert_and_quantitize(result["total"])


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
@pytest.mark.parametrize(
    "group_by, choices_class",
    (("type", AssetTypes), ("sector", AssetSectors), ("objective", AssetObjectives)),
)
def test__current_total_invested_report(client, group_by, choices_class):
    # GIVEN
    field = "metadata__sector" if group_by == "sector" else group_by
    totals = {
        v: sum(
            get_current_total_invested_brute_force(Asset.objects.get(pk=asset.write_model_pk))
            for asset in AssetReadModel.objects.filter(**{field: v})
        )
        for v in choices_class.values
    }

    # WHEN
    response = client.get(
        f"{URL}/reports?kind=total_invested&percentage=false&current=true&group_by={group_by}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    for result in response.json():
        for choice, label in choices_class.choices:
            if label == result[group_by]:
                assert convert_and_quantitize(totals[choice]) == result["total"]


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
@pytest.mark.parametrize(
    "group_by, choices_class",
    (("type", AssetTypes), ("sector", AssetSectors), ("objective", AssetObjectives)),
)
def test__current_total_invested_report__percentage(client, group_by, choices_class):
    # GIVEN
    current_total = sum(
        get_current_total_invested_brute_force(asset) for asset in Asset.objects.all()
    )
    field = "metadata__sector" if group_by == "sector" else group_by
    totals = {
        v: sum(
            get_current_total_invested_brute_force(Asset.objects.get(pk=asset.write_model_pk))
            for asset in AssetReadModel.objects.filter(**{field: v})
        )
        for v in choices_class.values
    }

    # WHEN
    response = client.get(
        f"{URL}/reports?kind=total_invested&percentage=true&current=true&group_by={group_by}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK
    for result in response.json():
        for choice, label in choices_class.choices:
            if label == result[group_by]:
                assert (
                    float(
                        convert_to_percentage_and_quantitize(
                            value=totals[choice], total=current_total
                        )
                    )
                    == result["total"]
                )


def test__total_invested_report__should_fail_wo_required_filters(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/reports?kind=total_invested")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "percentage": ["Obrigatório para relatórios de total investido"],
        "current": ["Obrigatório para relatórios de total investido"],
        "group_by": ["This field is required."],
    }


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
@pytest.mark.parametrize(
    "group_by, choices_class",
    (("type", AssetTypes), ("sector", AssetSectors), ("objective", AssetObjectives)),
)
def test__roi_report__opened(client, group_by, choices_class):
    # GIVEN
    field = "metadata__sector" if group_by == "sector" else group_by
    totals = {
        v: sum(
            get_roi_brute_force(Asset.objects.get(pk=asset.write_model_pk))
            for asset in AssetReadModel.objects.opened().filter(**{field: v})
        )
        for v in choices_class.values
    }

    # WHEN
    response = client.get(f"{URL}/reports?kind=roi&opened=true&closed=false&group_by={group_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    for result in response.json():
        for choice, label in choices_class.choices:
            if label == result[group_by]:
                assert float(convert_and_quantitize(totals[choice])) == result["total"]


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
@pytest.mark.parametrize(
    "group_by, choices_class",
    (("type", AssetTypes), ("sector", AssetSectors), ("objective", AssetObjectives)),
)
def test__roi_report__closed(client, group_by, choices_class):
    # GIVEN
    field = "metadata__sector" if group_by == "sector" else group_by
    totals = {
        v: sum(
            get_roi_brute_force(Asset.objects.get(pk=asset.write_model_pk))
            for asset in AssetReadModel.objects.closed().filter(**{field: v})
        )
        for v in choices_class.values
    }

    # WHEN
    response = client.get(f"{URL}/reports?kind=roi&opened=false&closed=true&group_by={group_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    for result in response.json():
        for choice, label in choices_class.choices:
            if label == result[group_by]:
                assert float(convert_and_quantitize(totals[choice])) == result["total"]


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
@pytest.mark.parametrize(
    "group_by, choices_class",
    (("type", AssetTypes), ("sector", AssetSectors), ("objective", AssetObjectives)),
)
def test__roi_report__all(client, group_by, choices_class):
    # GIVEN
    field = "metadata__sector" if group_by == "sector" else group_by
    totals = {
        v: sum(
            get_roi_brute_force(Asset.objects.get(pk=asset.write_model_pk))
            for asset in AssetReadModel.objects.filter(**{field: v})
        )
        for v in choices_class.values
    }

    # WHEN
    response = client.get(f"{URL}/reports?kind=roi&opened=true&closed=true&group_by={group_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    for result in response.json():
        for choice, label in choices_class.choices:
            if label == result[group_by]:
                assert float(convert_and_quantitize(totals[choice])) == result["total"]


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
def test__roi_report__none(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/reports?kind=roi&opened=false&closed=false&group_by=type")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == []


def test__roi_report__should_fail_wo_required_filters(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/reports?kind=roi")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "opened": ["Obrigatório para relatórios ROI"],
        "closed": ["Obrigatório para relatórios ROI"],
        "group_by": ["This field is required."],
    }
