from datetime import date

import pytest

from shared.utils import (
    insert_zeros_if_no_data_in_monthly_historic_data,
    insert_zeros_if_no_data_in_yearly_historic_data,
)


class TestInsertZerosIfNoDataInMonthlyHistoricData:
    def test__fills_gaps_in_the_middle(self):
        # GIVEN
        start_date = date(year=2023, month=6, day=1)
        end_date = date(year=2023, month=9, day=1)
        historic = [
            {"month": start_date, "total": 100.0},
            {"month": end_date, "total": 100.0},
        ]

        # WHEN
        result = insert_zeros_if_no_data_in_monthly_historic_data(
            historic, start_date=start_date, end_date=end_date
        )

        # THEN
        assert result == [
            {"month": start_date, "total": 100.0},
            {"month": date(year=2023, month=7, day=1), "total": 0.0},
            {"month": date(year=2023, month=8, day=1), "total": 0.0},
            {"month": end_date, "total": 100.0},
        ]

    def test__empty_historic_fills_all_months_with_zeros(self):
        # GIVEN
        start_date = date(year=2023, month=1, day=15)
        end_date = date(year=2023, month=3, day=20)
        historic = []

        # WHEN
        result = insert_zeros_if_no_data_in_monthly_historic_data(
            historic, start_date=start_date, end_date=end_date
        )

        # THEN
        assert result == [
            {"month": date(year=2023, month=1, day=1), "total": 0.0},
            {"month": date(year=2023, month=2, day=1), "total": 0.0},
            {"month": date(year=2023, month=3, day=1), "total": 0.0},
        ]

    def test__no_gaps_returns_same_data(self):
        # GIVEN
        start_date = date(year=2023, month=1, day=1)
        end_date = date(year=2023, month=3, day=1)
        historic = [
            {"month": date(year=2023, month=1, day=1), "total": 100.0},
            {"month": date(year=2023, month=2, day=1), "total": 200.0},
            {"month": date(year=2023, month=3, day=1), "total": 300.0},
        ]

        # WHEN
        result = insert_zeros_if_no_data_in_monthly_historic_data(
            historic, start_date=start_date, end_date=end_date
        )

        # THEN
        assert result == historic

    def test__custom_field_names(self):
        # GIVEN
        start_date = date(year=2023, month=1, day=1)
        end_date = date(year=2023, month=2, day=1)
        historic = [
            {"period": date(year=2023, month=1, day=1), "amount": 100.0},
        ]

        # WHEN
        result = insert_zeros_if_no_data_in_monthly_historic_data(
            historic,
            start_date=start_date,
            end_date=end_date,
            month_field="period",
            total_fields=("amount",),
        )

        # THEN
        assert result == [
            {"period": date(year=2023, month=1, day=1), "amount": 100.0},
            {"period": date(year=2023, month=2, day=1), "amount": 0.0},
        ]

    def test__multiple_total_fields(self):
        # GIVEN
        start_date = date(year=2023, month=1, day=1)
        end_date = date(year=2023, month=2, day=1)
        historic = [
            {"month": date(year=2023, month=1, day=1), "income": 100.0, "expense": 50.0},
        ]

        # WHEN
        result = insert_zeros_if_no_data_in_monthly_historic_data(
            historic,
            start_date=start_date,
            end_date=end_date,
            total_fields=("income", "expense"),
        )

        # THEN
        assert result == [
            {"month": date(year=2023, month=1, day=1), "income": 100.0, "expense": 50.0},
            {"month": date(year=2023, month=2, day=1), "income": 0.0, "expense": 0.0},
        ]

    def test__single_month_range(self):
        # GIVEN
        start_date = date(year=2023, month=5, day=10)
        end_date = date(year=2023, month=5, day=25)
        historic = []

        # WHEN
        result = insert_zeros_if_no_data_in_monthly_historic_data(
            historic, start_date=start_date, end_date=end_date
        )

        # THEN
        assert result == [
            {"month": date(year=2023, month=5, day=1), "total": 0.0},
        ]


class TestInsertZerosIfNoDataInYearlyHistoricData:
    def test__fills_gaps_in_the_middle(self):
        # GIVEN
        start_date = date(year=2020, month=6, day=15)
        end_date = date(year=2023, month=3, day=10)
        historic = [
            {"year": date(year=2020, month=1, day=1), "total": 1000.0},
            {"year": date(year=2023, month=1, day=1), "total": 4000.0},
        ]

        # WHEN
        result = insert_zeros_if_no_data_in_yearly_historic_data(
            historic, start_date=start_date, end_date=end_date
        )

        # THEN
        assert result == [
            {"year": date(year=2020, month=1, day=1), "total": 1000.0},
            {"year": date(year=2021, month=1, day=1), "total": 0.0},
            {"year": date(year=2022, month=1, day=1), "total": 0.0},
            {"year": date(year=2023, month=1, day=1), "total": 4000.0},
        ]

    def test__empty_historic_fills_all_years_with_zeros(self):
        # GIVEN
        start_date = date(year=2021, month=6, day=15)
        end_date = date(year=2023, month=3, day=10)
        historic = []

        # WHEN
        result = insert_zeros_if_no_data_in_yearly_historic_data(
            historic, start_date=start_date, end_date=end_date
        )

        # THEN
        assert result == [
            {"year": date(year=2021, month=1, day=1), "total": 0.0},
            {"year": date(year=2022, month=1, day=1), "total": 0.0},
            {"year": date(year=2023, month=1, day=1), "total": 0.0},
        ]

    def test__no_gaps_returns_same_data(self):
        # GIVEN
        start_date = date(year=2021, month=1, day=1)
        end_date = date(year=2023, month=12, day=31)
        historic = [
            {"year": date(year=2021, month=1, day=1), "total": 1000.0},
            {"year": date(year=2022, month=1, day=1), "total": 2000.0},
            {"year": date(year=2023, month=1, day=1), "total": 3000.0},
        ]

        # WHEN
        result = insert_zeros_if_no_data_in_yearly_historic_data(
            historic, start_date=start_date, end_date=end_date
        )

        # THEN
        assert result == historic

    def test__custom_field_names(self):
        # GIVEN
        start_date = date(year=2022, month=1, day=1)
        end_date = date(year=2023, month=12, day=31)
        historic = [
            {"period": date(year=2022, month=1, day=1), "amount": 500.0},
        ]

        # WHEN
        result = insert_zeros_if_no_data_in_yearly_historic_data(
            historic,
            start_date=start_date,
            end_date=end_date,
            year_field="period",
            total_fields=("amount",),
        )

        # THEN
        assert result == [
            {"period": date(year=2022, month=1, day=1), "amount": 500.0},
            {"period": date(year=2023, month=1, day=1), "amount": 0.0},
        ]

    def test__multiple_total_fields(self):
        # GIVEN
        start_date = date(year=2022, month=1, day=1)
        end_date = date(year=2023, month=12, day=31)
        historic = [
            {"year": date(year=2022, month=1, day=1), "revenue": 10000.0, "cost": 5000.0},
        ]

        # WHEN
        result = insert_zeros_if_no_data_in_yearly_historic_data(
            historic,
            start_date=start_date,
            end_date=end_date,
            total_fields=("revenue", "cost"),
        )

        # THEN
        assert result == [
            {"year": date(year=2022, month=1, day=1), "revenue": 10000.0, "cost": 5000.0},
            {"year": date(year=2023, month=1, day=1), "revenue": 0.0, "cost": 0.0},
        ]

    def test__single_year_range(self):
        # GIVEN
        start_date = date(year=2023, month=3, day=15)
        end_date = date(year=2023, month=10, day=20)
        historic = []

        # WHEN
        result = insert_zeros_if_no_data_in_yearly_historic_data(
            historic, start_date=start_date, end_date=end_date
        )

        # THEN
        assert result == [
            {"year": date(year=2023, month=1, day=1), "total": 0.0},
        ]
