from decimal import ROUND_UP

from rest_framework import serializers

from .models import Revenue


class RevenueSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Revenue
        fields = ("id", "value", "description", "created_at", "user")


class RevenueIndicatorsSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_UP)
    month = serializers.DateField(format="%d/%m/%Y")
    diff = serializers.DecimalField(max_digits=8, decimal_places=2, rounding=ROUND_UP)
    diff_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, rounding=ROUND_UP
    )
