from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, TypedDict

from django.utils import timezone

from dateutil.relativedelta import relativedelta
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.viewsets import GenericViewSet

from expenses.models import BankAccount, BankAccountSnapshot
from expenses.permissions import PersonalFinancesModulePermission
from shared.permissions import SubscriptionEndedPermission
from variable_income_assets.models import AssetReadModel, AssetsTotalInvestedSnapshot
from variable_income_assets.permissions import InvestmentsModulePermission

from .filters import PatrimonyGrowthFilterSet
from .serializers import PatrimonyGrowthSerializer

if TYPE_CHECKING:
    from datetime import date


class _Historical(TypedDict):
    total: Decimal
    operation_date: date


class PatrimonyViewSet(GenericViewSet):
    permission_classes = (
        SubscriptionEndedPermission,
        PersonalFinancesModulePermission,
        InvestmentsModulePermission,
    )

    @action(methods=("GET",), detail=False)
    def growth(self, request) -> Response:
        filterset = PatrimonyGrowthFilterSet(data=request.query_params)
        if not filterset.is_valid():
            return Response(filterset.errors, status=400)

        months = filterset.form.cleaned_data.get("months")
        years = filterset.form.cleaned_data.get("years")

        today = timezone.localdate()
        target_date = today - relativedelta(months=int(months or 0), years=int(years or 0))

        # Current patrimony: assets + bank account
        current_assets_total = (
            AssetReadModel.objects.filter(
                user_id=request.user.id
            ).aggregate_normalized_current_total()
        )["total"]

        try:
            current_bank_amount = BankAccount.objects.values_list("amount", flat=True).get(
                user_id=request.user.id
            )
        except BankAccount.DoesNotExist:
            current_bank_amount = Decimal()

        current_total = current_assets_total + current_bank_amount

        # Historical patrimony: assets snapshot + bank account snapshot
        historical_assets_snapshot = AssetsTotalInvestedSnapshot.objects.latest_before(
            request.user.id, target_date
        )
        historical_bank_snapshot = BankAccountSnapshot.objects.latest_before(
            request.user.id, target_date
        )

        # If neither snapshot exists, we can't calculate growth
        if not historical_assets_snapshot and not historical_bank_snapshot:
            return Response(
                {
                    "current_total": current_total,
                    "historical_total": None,
                    "historical_date": None,
                    "growth_percentage": None,
                }
            )

        historical_total, historical_date = self._resolve_historical_total_and_date(
            historical_assets_snapshot, historical_bank_snapshot
        )

        if historical_total == 0:
            growth_percentage = None
        else:
            growth_percentage = (
                (current_total / historical_total) - Decimal("1.0")
            ) * Decimal("100.0")

        serializer = PatrimonyGrowthSerializer(
            {
                "current_total": current_total,
                "historical_total": historical_total,
                "historical_date": historical_date,
                "growth_percentage": growth_percentage,
            }
        )
        return Response(serializer.data, status=HTTP_200_OK)

    @staticmethod
    def _resolve_historical_total_and_date(
        historical_assets_snapshot: _Historical | None, historical_bank_snapshot: _Historical | None
    ) -> tuple[Decimal, date | None]:

        historical_assets_total = (
            historical_assets_snapshot["total"] if historical_assets_snapshot else Decimal()
        )
        historical_bank_total = (
            historical_bank_snapshot["total"] if historical_bank_snapshot else Decimal()
        )
        historical_total = historical_assets_total + historical_bank_total

        # Use the earliest date of the two snapshots as the historical date
        historical_date = None
        if historical_assets_snapshot and historical_bank_snapshot:
            historical_date = min(
                historical_assets_snapshot["operation_date"],
                historical_bank_snapshot["operation_date"],
            )
        elif historical_assets_snapshot:
            historical_date = historical_assets_snapshot["operation_date"]
        elif historical_bank_snapshot:
            historical_date = historical_bank_snapshot["operation_date"]

        return historical_total, historical_date
