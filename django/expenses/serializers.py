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
                message=commands.CreateExpense(
                    expense=expense,
                    perform_actions_on_future_fixed_expenses=self.context.get(
                        "perform_actions_on_future_fixed_expenses", False
                    ),
                ),
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
                recurring_id=instance.recurring_id,
                **validated_data,
            )
            expense.validate_update(data_instance=instance)
            messagebus.handle(
                message=commands.UpdateExpense(
                    expense=expense,
                    data_instance=instance,
                    perform_actions_on_future_fixed_expenses=self.context.get(
                        "perform_actions_on_future_fixed_expenses", False
                    ),
                ),
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


class TotalSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class AvgSerializer(serializers.Serializer):
    avg = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class ExpenseReportCategorySerializer(TotalSerializer):
    category = CustomChoiceField(choices=ExpenseCategory.choices)


class ExpenseReportAvgCategorySerializer(ExpenseReportCategorySerializer, AvgSerializer): ...


class ExpenseReportSourceSerializer(TotalSerializer):
    source = CustomChoiceField(choices=ExpenseSource.choices)


class ExpenseReportAvgSourceSerializer(ExpenseReportSourceSerializer, AvgSerializer): ...


class ExpenseReportTypeSerializer(TotalSerializer):
    type = serializers.SerializerMethodField()
    is_fixed = serializers.BooleanField()

    def get_type(self, data: dict[str, bool | Decimal]) -> str:
        return "Fixo" if data["is_fixed"] is True else "Variável"


class ExpenseReportAvgTypeSerializer(ExpenseReportTypeSerializer, AvgSerializer): ...


class ExpenseHistoricSerializer(TotalSerializer):
    month = serializers.DateField(format="%d/%m/%Y")


class HistoricResponseSerializer(AvgSerializer, serializers.Serializer):
    historic = ExpenseHistoricSerializer(many=True)


class RevenueIndicatorsSerializer(TotalSerializer, AvgSerializer):
    diff = serializers.DecimalField(max_digits=8, decimal_places=2, rounding=ROUND_HALF_UP)


class ExpenseIndicatorsSerializer(RevenueIndicatorsSerializer):
    future = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = ("amount", "description", "updated_at")
        extra_kwargs = {"updated_at": {"read_only": True}}
