from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from dateutil.relativedelta import relativedelta

from shared.serializers_utils import CustomChoiceField

from .choices import ExpenseCategory, ExpenseSource
from .models import Expense


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
        )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        installments = attrs.get("installments") or 1
        if attrs.get("is_fixed", False) and installments > 1:
            raise ValidationError("Fixed expense with installments is not permitted")
        return attrs

    def create(self, validated_data: dict[str, Any]) -> Expense:
        installments = validated_data.pop("installments") or 1
        if installments > 1:
            validated_data["price"] /= installments
            created_at = validated_data.pop("created_at")
            description = validated_data.pop("description")
            return Expense.objects.bulk_create(
                objs=(
                    Expense(
                        description=f"{description} ({i+1}/{installments})",
                        created_at=created_at + relativedelta(months=i),
                        **validated_data,
                    )
                    for i in range(installments)
                )
            )[0]
        return super().create(validated_data)


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
