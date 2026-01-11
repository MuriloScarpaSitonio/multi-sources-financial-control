from decimal import ROUND_HALF_UP

from rest_framework import serializers


class PatrimonyGrowthSerializer(serializers.Serializer):
    current_total = serializers.DecimalField(max_digits=20, decimal_places=2)
    historical_total = serializers.DecimalField(max_digits=20, decimal_places=2, allow_null=True)
    historical_date = serializers.DateField(allow_null=True)
    growth_percentage = serializers.DecimalField(
        max_digits=10, decimal_places=2, allow_null=True, rounding=ROUND_HALF_UP
    )
