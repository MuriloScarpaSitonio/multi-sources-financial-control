from decimal import ROUND_UP

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


class _ExpenseReportCategorySerializer(_ExpenseExtraBaseSerializer):
    category = serializers.CharField()


class _ExpenseReportSourceSerializer(_ExpenseExtraBaseSerializer):
    source = serializers.CharField()


class _ExpenseReportTypeSerializer(_ExpenseExtraBaseSerializer):
    is_fixed = serializers.CharField()


class ExpenseReportSerializer(_ExpenseExtraBaseSerializer):
    categories = _ExpenseReportCategorySerializer(read_only=True, many=True)
    sources = _ExpenseReportSourceSerializer(read_only=True, many=True)
    type = _ExpenseReportTypeSerializer(read_only=True, many=True)


class ExpenseHistoricSerializer(_ExpenseExtraBaseSerializer):
    month = serializers.DateField(format="%d/%m/%Y")
