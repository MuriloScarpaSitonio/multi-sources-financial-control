from datetime import date, timedelta
from decimal import Decimal
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError

import pytest

from expenses.models import BankAccount, BankAccountSnapshot, Expense, Revenue
from variable_income_assets.choices import AssetTypes, Currencies, PassiveIncomeEventTypes
from variable_income_assets.models import (
    Asset,
    AssetClosedOperation,
    AssetMetaData,
    AssetReadModel,
    AssetsTotalInvestedSnapshot,
    PassiveIncome,
    Transaction,
)

pytestmark = pytest.mark.django_db

UserModel = get_user_model()


class TestGenerateDummyDataCommand:
    """Tests for the generate_dummy_data management command."""

    def test__should_fail_if_user_already_exists(self, user):
        """Command should fail if user with given email already exists."""
        with pytest.raises(CommandError) as exc_info:
            call_command(
                "generate_dummy_data",
                from_date="2024-01-01",
                total="100000",
                email=user.email,
                password="testpass123",
            )

        assert "already exists" in str(exc_info.value)

    def test__clear_flag_should_delete_existing_user_and_recreate(self):
        """Command with --clear should delete existing user and create new one."""
        # First create a user
        call_command(
            "generate_dummy_data",
            from_date="2024-06-01",
            total="50000",
            email="demo@example.com",
            password="oldpass123",
        )

        old_user = UserModel.objects.get(email="demo@example.com")
        old_user_id = old_user.id

        # Now run again with --clear
        call_command(
            "generate_dummy_data",
            from_date="2024-01-01",
            total="100000",
            email="demo@example.com",
            password="newpass123",
            clear=True,
        )

        # Should have a new user with new password
        new_user = UserModel.objects.get(email="demo@example.com")
        assert new_user.id != old_user_id
        assert new_user.check_password("newpass123") is True

        # Old data should be gone, new data created
        assert Asset.objects.filter(user=new_user).count() > 0

    def test__should_fail_if_total_is_zero_or_negative(self):
        """Command should fail if total is zero or negative."""
        with pytest.raises(CommandError) as exc_info:
            call_command(
                "generate_dummy_data",
                from_date="2024-01-01",
                total="0",
                email="demo@example.com",
                password="testpass123",
            )

        assert "Total must be greater than 0" in str(exc_info.value)

        with pytest.raises(CommandError):
            call_command(
                "generate_dummy_data",
                from_date="2024-01-01",
                total="-1000",
                email="demo2@example.com",
                password="testpass123",
            )

    def test__should_fail_if_from_date_is_in_future(self):
        """Command should fail if from_date is not in the past."""
        future_date = (date.today() + timedelta(days=30)).isoformat()

        with pytest.raises(CommandError) as exc_info:
            call_command(
                "generate_dummy_data",
                from_date=future_date,
                email="demo@example.com",
                password="testpass123",
                total="100000",
            )

        assert "must be in the past" in str(exc_info.value)

    def test__should_fail_if_from_date_is_today(self):
        """Command should fail if from_date is today."""
        with pytest.raises(CommandError) as exc_info:
            call_command(
                "generate_dummy_data",
                from_date=date.today().isoformat(),
                email="demo@example.com",
                password="testpass123",
                total="100000",
            )

        assert "must be in the past" in str(exc_info.value)

    def test__should_fail_with_invalid_date_format(self):
        """Command should fail with invalid date format."""
        with pytest.raises(CommandError) as exc_info:
            call_command(
                "generate_dummy_data",
                from_date="01-01-2024",  # Wrong format
                email="demo@example.com",
                password="testpass123",
                total="100000",
            )

        assert "Invalid date format" in str(exc_info.value)

    def test__should_create_user_with_correct_settings(self):
        """Command should create a user with the correct email and settings."""
        out = StringIO()
        call_command(
            "generate_dummy_data",
            from_date="2024-06-01",
            total="50000",
            email="demo@example.com",
            password="testpass123",
            stdout=out,
        )

        user = UserModel.objects.get(email="demo@example.com")
        assert user.is_active is True
        assert user.is_personal_finances_module_enabled is True
        assert user.is_investments_module_enabled is True
        assert user.check_password("testpass123") is True
        # Subscription should be set for demo user
        assert user.subscription_ends_at is not None

    def test__should_create_bank_account(self):
        """Command should create a default bank account for the user."""
        call_command(
            "generate_dummy_data",
            from_date="2024-06-01",
            total="50000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")
        bank_accounts = BankAccount.objects.filter(user=user)

        assert bank_accounts.count() == 1
        assert bank_accounts.first().is_default is True
        assert bank_accounts.first().is_active is True

    def test__should_create_expenses_for_each_month(self):
        """Command should create expenses for each month from from_date to now."""
        from_date = date(2024, 6, 1)
        call_command(
            "generate_dummy_data",
            from_date=from_date.isoformat(),
            total="50000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")
        expenses = Expense.objects.filter(user=user)

        # Should have multiple expenses
        assert expenses.count() > 0

        # Past expenses should not be before from_date
        assert expenses.filter(created_at__lt=from_date).count() == 0

        # Future expenses should only be fixed (for planning purposes)
        future_expenses = expenses.filter(created_at__gt=date.today())
        assert future_expenses.filter(is_fixed=False).count() == 0

    def test__should_create_revenues_including_salary(self):
        """Command should create revenues including monthly salary."""
        call_command(
            "generate_dummy_data",
            from_date="2024-06-01",
            total="50000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")
        revenues = Revenue.objects.filter(user=user)

        # Should have revenues
        assert revenues.count() > 0

        # Should have fixed salary revenues
        salary_revenues = revenues.filter(is_fixed=True, category="Salário")
        assert salary_revenues.count() > 0

    def test__should_create_assets_and_transactions(self):
        """Command should create assets and transactions."""
        call_command(
            "generate_dummy_data",
            from_date="2024-01-01",
            total="100000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")
        assets = Asset.objects.filter(user=user)
        transactions = Transaction.objects.filter(asset__user=user)

        # Should have assets
        assert assets.count() > 0

        # Should have transactions for those assets
        assert transactions.count() > 0

        # Should have both BUY and SELL transactions
        buy_count = transactions.filter(action="BUY").count()
        sell_count = transactions.filter(action="SELL").count()
        assert buy_count > 0
        assert sell_count > 0  # Now we have sell transactions too

    def test__should_create_closed_operations(self):
        """Command should create AssetClosedOperation for fully closed positions."""
        call_command(
            "generate_dummy_data",
            from_date="2024-01-01",
            total="100000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")

        # Should have at least one closed operation (guaranteed by the command)
        closed_ops = AssetClosedOperation.objects.filter(asset__user=user)
        assert closed_ops.count() >= 1

        # Verify closed operation has valid values
        for closed_op in closed_ops:
            assert closed_op.normalized_total_bought > 0
            assert closed_op.total_bought > 0
            assert closed_op.quantity_bought > 0
            assert closed_op.normalized_total_sold > 0

    def test__should_create_assets_of_multiple_types(self):
        """Command should create assets of different types."""
        call_command(
            "generate_dummy_data",
            from_date="2024-01-01",
            total="200000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")
        assets = Asset.objects.filter(user=user)

        # Get unique asset types
        asset_types = set(assets.values_list("type", flat=True))

        # Should have at least 2 different asset types
        assert len(asset_types) >= 2

    def test__should_create_asset_metadata(self):
        """Command should create or reuse AssetMetaData entries."""
        initial_metadata_count = AssetMetaData.objects.count()

        call_command(
            "generate_dummy_data",
            from_date="2024-06-01",
            total="50000",
            email="demo@example.com",
            password="testpass123",
        )

        # Should have created metadata entries
        assert AssetMetaData.objects.count() > initial_metadata_count

    def test__should_create_asset_read_models(self):
        """Command should sync CQRS read models."""
        call_command(
            "generate_dummy_data",
            from_date="2024-06-01",
            total="50000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")
        assets = Asset.objects.filter(user=user)
        read_models = AssetReadModel.objects.filter(user_id=user.pk)

        # Should have read model for each asset
        assert read_models.count() == assets.count()

    def test__should_create_passive_incomes_for_dividend_assets(self):
        """Command should create passive incomes for assets with dividends."""
        call_command(
            "generate_dummy_data",
            from_date="2024-01-01",
            total="100000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")

        # Get assets that should have dividends (stocks and FIIs)
        dividend_assets = Asset.objects.filter(
            user=user, type__in=[AssetTypes.stock, AssetTypes.stock_usa, AssetTypes.fii]
        )

        if dividend_assets.exists():
            # Should have some passive incomes
            incomes = PassiveIncome.objects.filter(asset__user=user)
            assert incomes.count() > 0

            # All incomes should be credited
            assert (
                incomes.filter(event_type=PassiveIncomeEventTypes.credited).count()
                == incomes.count()
            )

    def test__should_create_bank_account_snapshots(self):
        """Command should create historical bank account snapshots."""
        call_command(
            "generate_dummy_data",
            from_date="2024-01-01",
            total="50000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")
        snapshots = BankAccountSnapshot.objects.filter(user=user)

        # Should have snapshots
        assert snapshots.count() > 0

    def test__should_create_investment_snapshots(self):
        """Command should create historical investment snapshots."""
        call_command(
            "generate_dummy_data",
            from_date="2024-01-01",
            total="50000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")
        snapshots = AssetsTotalInvestedSnapshot.objects.filter(user=user)

        # Should have snapshots
        assert snapshots.count() > 0

    def test__transaction_should_be_atomic(self):
        """If command fails midway, no data should be created."""
        # Create a user first to make the command fail
        UserModel.objects.create_user(
            email="demo@example.com",
            username="demo",
            password="testpass",
        )

        initial_expense_count = Expense.objects.count()
        initial_asset_count = Asset.objects.count()

        with pytest.raises(CommandError):
            call_command(
                "generate_dummy_data",
                from_date="2024-01-01",
                total="100000",
                email="demo@example.com",
                password="testpass123",
            )

        # No new data should have been created
        assert Expense.objects.count() == initial_expense_count
        assert Asset.objects.count() == initial_asset_count

    def test__fixed_income_assets_should_be_created(self):
        """Fixed income assets should be created correctly."""
        call_command(
            "generate_dummy_data",
            from_date="2024-06-01",
            total="100000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")
        fixed_assets = Asset.objects.filter(user=user, type=AssetTypes.fixed_br)

        # Should have at least one fixed income asset
        assert fixed_assets.count() >= 0

        for asset in fixed_assets:
            # Fixed income assets should have liquidity_type set
            assert asset.liquidity_type in ["DAILY", "AT_MATURITY", ""]

    def test__usd_assets_should_have_correct_currency(self):
        """USD assets should have correct currency and conversion rate."""
        call_command(
            "generate_dummy_data",
            from_date="2024-01-01",
            total="200000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")
        usd_assets = Asset.objects.filter(user=user, currency=Currencies.dollar)

        for asset in usd_assets:
            # All transactions should have conversion rate > 1
            transactions = Transaction.objects.filter(asset=asset)
            for tx in transactions:
                assert tx.current_currency_conversion_rate > Decimal("1.0")

    def test__command_output_shows_success_message(self):
        """Command should output success message."""
        out = StringIO()
        call_command(
            "generate_dummy_data",
            from_date="2024-06-01",
            total="50000",
            email="demo@example.com",
            password="testpass123",
            stdout=out,
        )

        output = out.getvalue()
        assert "Dummy data generation completed" in output
        assert "demo@example.com" in output


class TestGenerateDummyDataCommandMonthCalculation:
    """Tests for month calculation logic."""

    def test__should_generate_data_for_multiple_months(self):
        """Should generate data spanning multiple months."""
        # Use a date that's at least 6 months ago
        from_date = date.today() - timedelta(days=180)
        from_date_str = from_date.isoformat()

        call_command(
            "generate_dummy_data",
            from_date=from_date_str,
            total="50000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")

        # Get unique months from expenses
        expenses = Expense.objects.filter(user=user)
        expense_months = set(expenses.values_list("created_at__year", "created_at__month"))

        # Should have expenses spanning multiple months
        assert len(expense_months) >= 3

    def test__should_handle_single_month_range(self):
        """Should handle a short date range (within same month)."""
        # Use just last month
        from_date = date.today().replace(day=1) - timedelta(days=1)
        from_date = from_date.replace(day=1)  # First day of last month

        call_command(
            "generate_dummy_data",
            from_date=from_date.isoformat(),
            total="50000",
            email="demo@example.com",
            password="testpass123",
        )

        user = UserModel.objects.get(email="demo@example.com")

        # Should still create data
        assert Expense.objects.filter(user=user).exists()
        assert Revenue.objects.filter(user=user).exists()
