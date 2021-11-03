from decimal import ROUND_UP, Decimal
from typing import Dict, Union

from rest_framework import serializers

from shared.serializers_utils import CustomChoiceField

from .choices import ExpenseCategory, ExpenseSource
from .models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    source = CustomChoiceField(choices=ExpenseSource.choices)
    category = CustomChoiceField(choices=ExpenseCategory.choices)
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

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
        )


class _ExpenseExtraBaseSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_UP)


class ExpenseReportCategorySerializer(_ExpenseExtraBaseSerializer):
    category = CustomChoiceField(choices=ExpenseCategory.choices)


class ExpenseReportSourceSerializer(_ExpenseExtraBaseSerializer):
    source = CustomChoiceField(choices=ExpenseSource.choices)


class ExpenseReportTypeSerializer(_ExpenseExtraBaseSerializer):
    type = serializers.SerializerMethodField()
    is_fixed = serializers.BooleanField()

    def get_type(self, obj: Dict[str, Union[bool, Decimal]]) -> str:
        return "Fixo" if obj["is_fixed"] is True else "Variável"


class ExpenseHistoricSerializer(_ExpenseExtraBaseSerializer):
    month = serializers.DateField(format="%d/%m/%Y")


class ExpenseIndicatorsSerializer(ExpenseHistoricSerializer):
    diff = serializers.DecimalField(max_digits=8, decimal_places=2, rounding=ROUND_UP)
    diff_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, rounding=ROUND_UP
    )
