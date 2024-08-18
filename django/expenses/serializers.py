from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from rest_framework import serializers

from shared.serializers_utils import CustomChoiceField

from .choices import ExpenseCategory, ExpenseSource
from .domain import commands
from .domain.exceptions import ValidationError as DomainValidationError
from .domain.models import Expense as ExpenseDomainModel
from .models import BankAccount, Expense, Revenue
from .service_layer import messagebus
from .service_layer.unit_of_work import ExpenseUnitOfWork


class ExpenseSerializer(serializers.ModelSerializer):
    source = CustomChoiceField(choices=ExpenseSource.choices)
    category = CustomChoiceField(choices=ExpenseCategory.choices)
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    installments = serializers.IntegerField(default=1, write_only=True, allow_null=True)

    class Meta:
        model = Expense
        fields = (
            "id",
            "value",
            "description",
            "category",
            "created_at",
            "source",
            "is_fixed",
            "user",
            "installments",
            "full_description",
        )

    def create(self, validated_data: dict[str, Any]) -> Expense:
        try:
            user = validated_data.pop("user")
            expense = ExpenseDomainModel(
                **validated_data, installments_qty=validated_data.pop("installments") or 1
            )
            messagebus.handle(
                message=commands.CreateExpense(expense=expense),
                uow=ExpenseUnitOfWork(user_id=user.id),
            )
            return expense
        except DomainValidationError as e:
            raise serializers.ValidationError(e.detail) from e

    def update(self, instance: Expense, validated_data: dict) -> Expense:
        try:
            validated_data.pop("installments")
            user = validated_data.pop("user")
            expense = ExpenseDomainModel(
                id=instance.pk,
                installments_id=instance.installments_id,
                installments_qty=instance.installments_qty or 1,
                **validated_data,
            )
            expense.validate_update(data_instance=instance)
            messagebus.handle(
                message=commands.UpdateExpense(expense=expense, data_instance=instance),
                uow=ExpenseUnitOfWork(user_id=user.id),
            )
            return expense
        except DomainValidationError as e:
            raise serializers.ValidationError(e.detail) from e


class RevenueSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Revenue
        fields = (
            "id",
            "value",
            "description",
            "created_at",
            "is_fixed",
            "user",
            "full_description",
        )


class _ExpenseBaseSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class _ExpenseReportGroupBySerializer(_ExpenseBaseSerializer):
    avg = serializers.DecimalField(
        max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP, required=False
    )


class ExpenseReportCategorySerializer(_ExpenseReportGroupBySerializer):
    category = CustomChoiceField(choices=ExpenseCategory.choices)


class ExpenseReportSourceSerializer(_ExpenseReportGroupBySerializer):
    source = CustomChoiceField(choices=ExpenseSource.choices)


class ExpenseReportTypeSerializer(_ExpenseReportGroupBySerializer):
    type = serializers.SerializerMethodField()
    is_fixed = serializers.BooleanField()

    def get_type(self, data: dict[str, bool | Decimal]) -> str:
        return "Fixo" if data["is_fixed"] is True else "Variável"


class ExpenseHistoricSerializer(_ExpenseBaseSerializer):
    month = serializers.DateField(format="%d/%m/%Y")


class HistoricResponseSerializer(serializers.Serializer):
    historic = ExpenseHistoricSerializer(many=True)
    avg = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class RevenueIndicatorsSerializer(_ExpenseBaseSerializer):
    avg = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)
    diff = serializers.DecimalField(max_digits=8, decimal_places=2, rounding=ROUND_HALF_UP)


class ExpenseIndicatorsSerializer(RevenueIndicatorsSerializer):
    future = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = ("amount", "description", "updated_at")
        extra_kwargs = {"updated_at": {"read_only": True}}
