from datetime import date

from utils import insert_zeros_if_no_data_in_monthly_historic_data


def test__insert_zeros_if_no_data_in_monthly_historic_data():
    # GIVEN
    historic = [
        {"month": date(year=2023, month=6, day=1), "total": 100.0},
        {"month": date(year=2023, month=9, day=1), "total": 100.0},
    ]

    # WHEN
    result = insert_zeros_if_no_data_in_monthly_historic_data(historic)

    # THEN
    assert result == [
        {"month": date(year=2023, month=6, day=1), "total": 100.0},
        {"month": date(year=2023, month=7, day=1), "total": 0.0},
        {"month": date(year=2023, month=8, day=1), "total": 0.0},
        {"month": date(year=2023, month=9, day=1), "total": 100.0},
    ]
