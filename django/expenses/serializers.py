from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from dateutil.relativedelta import relativedelta
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from shared.serializers_utils import CustomChoiceField

from .choices import ExpenseCategory, ExpenseSource
from .models import Expense

if TYPE_CHECKING:
    from datetime import date


class ExpenseSerializer(serializers.ModelSerializer):
    source = CustomChoiceField(choices=ExpenseSource.choices)
    category = CustomChoiceField(choices=ExpenseCategory.choices)
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    installments = serializers.IntegerField(default=1, write_only=True, allow_null=True)

    class Meta:
        model = Expense
        fields = (
            "id",
            "price",
            "description",
            "category",
            "created_at",
            "source",
            "is_fixed",
            "user",
            "installments",
            "full_description",
        )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        installments = attrs.get("installments") or 1
        if attrs.get("is_fixed", False) and installments > 1:
            raise ValidationError("Fixed expense with installments is not permitted")
        return attrs

    def validate_created_at(self, created_at: date) -> date:
        if (
            self.instance
            and self.instance.installment_number is not None
            and self.instance.installment_number != 1
            and self.instance.created_at != created_at
        ):
            raise ValidationError("You can only update the date of the first installment")
        return created_at

    def create(self, validated_data: dict[str, Any]) -> Expense:
        installments = validated_data.pop("installments") or 1
        if installments > 1:
            validated_data["price"] /= installments
            created_at = validated_data.pop("created_at")
            installments_id = uuid4()
            return Expense.objects.bulk_create(
                objs=(
                    Expense(
                        created_at=created_at + relativedelta(months=i),
                        installments_id=installments_id,
                        installments_qty=installments,
                        installment_number=i + 1,
                        **validated_data,
                    )
                    for i in range(installments)
                )
            )[0]
        return super().create(validated_data)

    def update(self, instance: Expense, validated_data: dict) -> Expense:
        if instance.installments_id is None:
            return super().update(instance, validated_data)

        installments_qs = Expense.objects.filter(installments_id=instance.installments_id)
        validated_data.pop("user")
        validated_data.pop("installments")
        if instance.created_at != validated_data["created_at"]:
            # `releativedelta` does work with django's `F` object so the following does not work
            # date_fiff = instance.created_at - validated_data["created_at"]
            # F("created_at") - relativedelta(seconds=int(date_diff.total_seconds()))

            expenses: list[Expense] = []
            for i, expense in enumerate(installments_qs.order_by("created_at")):
                expense.created_at = validated_data["created_at"] + relativedelta(months=i)
                expenses.append(expense)

            Expense.objects.bulk_update(objs=expenses, fields=("created_at",))

        validated_data.pop("created_at")
        installments_qs.update(**validated_data)

        instance.refresh_from_db()
        return instance


class _ExpenseExtraBaseSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class ExpenseReportCategorySerializer(_ExpenseExtraBaseSerializer):
    category = CustomChoiceField(choices=ExpenseCategory.choices)
    avg = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class ExpenseReportSourceSerializer(_ExpenseExtraBaseSerializer):
    source = CustomChoiceField(choices=ExpenseSource.choices)
    avg = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class ExpenseReportTypeSerializer(_ExpenseExtraBaseSerializer):
    type = serializers.SerializerMethodField()
    avg = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)
    is_fixed = serializers.BooleanField()

    def get_type(self, data: dict[str, bool | Decimal]) -> str:
        return "Fixo" if data["is_fixed"] is True else "Variável"


class ExpenseHistoricSerializer(_ExpenseExtraBaseSerializer):
    month = serializers.DateField(format="%d/%m/%Y")


class ExpenseHistoricResponseSerializer(serializers.Serializer):
    historic = ExpenseHistoricSerializer(many=True)
    avg = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class ExpenseIndicatorsSerializer(_ExpenseExtraBaseSerializer):
    avg = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)
    diff = serializers.DecimalField(max_digits=8, decimal_places=2, rounding=ROUND_HALF_UP)
    future = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)
