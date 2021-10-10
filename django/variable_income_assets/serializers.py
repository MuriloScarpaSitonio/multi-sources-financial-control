from decimal import Decimal, ROUND_UP

from rest_framework import serializers

from shared.serializers_utils import CustomChoiceField

from .choices import AssetTypes
from .models import Asset


class AssetSerializer(serializers.ModelSerializer):
    type = CustomChoiceField(choices=AssetTypes.choices)
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    avg_price = serializers.DecimalField(
        max_digits=7,
        decimal_places=2,
        read_only=True,
        rounding=ROUND_UP,
    )
    adjusted_avg_price = serializers.DecimalField(
        max_digits=7,
        decimal_places=2,
        read_only=True,
        rounding=ROUND_UP,
    )
    ROI = serializers.DecimalField(
        source="get_ROI",
        max_digits=7,
        decimal_places=2,
        read_only=True,
        rounding=ROUND_UP,
    )
    ROI_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = (
            "code",
            "type",
            "user",
            "avg_price",
            "adjusted_avg_price",
            "ROI",
            "ROI_percentage",
        )

    def get_ROI_percentage(self, obj) -> Decimal:
        return obj.get_ROI(percentage=True)
