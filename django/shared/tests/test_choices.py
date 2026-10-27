import os
import subprocess
import sys
from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError

import pytest
from pydantic import ValidationError as PydanticValidationError
from rest_framework import serializers

from expenses.choices import ExpenseReportType
from expenses.models import ExpenseCategory
from tasks.choices import TaskStates
from tasks.models import TaskHistory
from tasks.serializers import TaskHistorySerializer
from variable_income_assets.choices import AssetTypes, Currencies, TransactionActions
from variable_income_assets.integrations.schemas import TransactionPydanticModel
from variable_income_assets.models import Asset, Transaction
from variable_income_assets.serializers import TransactionSerializer


def test_integration_uses_native_enum_and_preserves_wire_values():
    transaction = TransactionPydanticModel(
        id="external-id",
        price=Decimal("12.50"),
        quantity=Decimal("2"),
        operation_date=date(2026, 1, 1),
        action="BUY",
        currency="BRL",
        code="PETR4",
    )

    assert transaction.action is TransactionActions.buy
    assert transaction.currency is Currencies.real
    assert transaction.action.value == "BUY"
    assert transaction.model_dump(mode="json")["action"] == "BUY"
    assert "currency" not in transaction.model_dump(mode="json")
    with pytest.raises(PydanticValidationError):
        TransactionPydanticModel.model_validate(
            {**transaction.model_dump(), "code": "PETR4", "currency": "BRL", "action": "INVALID"}
        )


@pytest.mark.parametrize(
    "value,currencies,threshold,accept_incomes",
    [
        ("STOCK", ("BRL",), 20_000, True),
        ("STOCK_USA", ("USD",), 35_000, True),
        ("EQUITY_GLOBAL", ("USD",), 35_000, True),
        ("CRYPTO", ("BRL", "USD"), 35_000, True),
        ("FII", ("BRL",), 0, True),
        ("FIXED_BR", ("BRL",), 0, False),
    ],
)
def test_asset_rules_can_be_resolved_from_stored_values(
    value, currencies, threshold, accept_incomes
):
    asset_type = AssetTypes(value)
    assert asset_type.valid_currencies == currencies
    assert asset_type.monthly_sell_threshold == threshold
    assert asset_type.accept_incomes is accept_incomes


@pytest.mark.parametrize(
    "value,field_name,serializer_name",
    [
        ("type", "is_fixed", "ExpenseReportTypeSerializer"),
        ("category", "category", "ExpenseReportCategorySerializer"),
        ("source", "source", "ExpenseReportSourceSerializer"),
    ],
)
def test_expense_report_routing(value, field_name, serializer_name):
    report = ExpenseReportType(value)
    assert report.field_name == field_name
    assert report.serializer_name == serializer_name


@pytest.mark.parametrize(
    "state,suffix",
    [
        ("PENDING", "enfileirada"),
        ("STARTED", "iniciada"),
        ("SUCCESS", "finalizada"),
        ("FAILURE", "falhou"),
    ],
)
def test_task_notification_from_stored_state(state, suffix):
    task = TaskHistory(name="sync_binance_transactions_task", state=state)
    title = TaskHistorySerializer().get_notification_display_title(task)
    assert title == f"Integração 'Transações da Binance' {suffix}"


def test_unknown_task_state_retains_notification_fallback():
    task = TaskHistory(name="sync_binance_transactions_task", state="REMOVED")
    assert TaskHistorySerializer().get_notification_display_title(task) == "Integração depreceada"


def test_automatic_serializer_preserves_action_validation():
    field = TransactionSerializer().fields["action"]
    assert field.run_validation(" BUY ") == "BUY"
    with pytest.raises(serializers.ValidationError) as exc:
        field.run_validation("INVALID")
    assert str(exc.value.detail[0]) == (
        "Select a valid choice. INVALID is not one of the available choices."
    )
    assert exc.value.detail[0].code == "invalid"


@pytest.mark.parametrize(
    "model,field_name,valid,invalid",
    [
        (Transaction, "action", "BUY", "buy"),
        (TaskHistory, "state", "PENDING", "pending"),
        (ExpenseCategory, "hex_color", "#906CCC", "#000000"),
        (Asset, "currency", "", "EUR"),
        (Asset, "indexer", "", "INVALID"),
        (Asset, "liquidity_type", "", "INVALID"),
    ],
)
def test_model_field_validation_is_preserved(model, field_name, valid, invalid):
    field = model._meta.get_field(field_name)
    assert field.clean(valid, model()) == valid
    with pytest.raises(ValidationError):
        field.clean(invalid, model())


def test_application_and_migration_history_load_without_django_choices():
    script = """
import importlib.abc
import sys

class BlockDjangoChoices(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == 'djchoices' or fullname.startswith('djchoices.'):
            raise ModuleNotFoundError('django-choices must not be required')

sys.meta_path.insert(0, BlockDjangoChoices())
import django
django.setup()
from django.db.migrations.loader import MigrationLoader
state = MigrationLoader(None).project_state()
field = state.apps.get_model('tasks', 'TaskHistory')._meta.get_field('state')
assert field.clean('PENDING', None) == 'PENDING'
"""
    result = subprocess.run(
        [sys.executable, "-B", "-c", script],
        env={**os.environ, "DJANGO_SETTINGS_MODULE": "config.settings.base"},
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
