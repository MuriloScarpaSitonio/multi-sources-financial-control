from django.utils import timezone
from django.db.models import QuerySet

from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from shared.utils import coalesce_sum_expression
from tasks.decorators import celery_task_endpoint, start_celery_task
from variable_income_assets.tasks import (
    sync_binance_transactions_task,
    sync_cei_transactions_task,
    sync_cei_passive_incomes_task,
    sync_kucoin_transactions_task,
    fetch_current_assets_prices,
)

from .filters import AssetFilterSet, AssetFetchCurrentPriceFilterSet, AssetReportFilterSet
from .models import Asset, PassiveIncome
from .permissions import AssetsPricesPermission, BinancePermission, CeiPermission, KuCoinPermission
from .serializers import (
    AssetReportSerializer,
    AssetRoidIndicatorsSerializer,
    AssetSerializer,
    PassiveIncomeSerializer,
    PassiveIncomesIndicatorsSerializer,
)


class AssetViewSet(GenericViewSet, ListModelMixin):
    serializer_class = AssetSerializer
    filterset_class = AssetFilterSet
    ordering_fields = ("code", "type", "total_invested", "roi", "roi_percentage")

    def get_queryset(self) -> QuerySet[Asset]:
        qs = (
            self.request.user.assets.all()
            if self.request.user.is_authenticated
            else Asset.objects.none()  # drf-spectatular
        )
        if self.action == "list":
            qs = qs.opened().annotate_for_serializer().order_by("code")

        return qs

    def get_serializer_context(self):
        qs = self.get_queryset()
        return {**qs.total_invested(), **qs.current_total()}

    @action(methods=("GET",), detail=False)
    def indicators(self, _: Request) -> Response:
        qs = self.get_queryset()
        current_total = qs.current_total()["current_total"]
        opened = (
            qs.opened()
            .annotate_roi()
            .aggregate(ROI_opened=coalesce_sum_expression("roi"))["ROI_opened"]
        )

        finished = (
            qs.finished()
            .annotate_roi()
            .aggregate(ROI_finished=coalesce_sum_expression("roi"))["ROI_finished"]
        )
        serializer = AssetRoidIndicatorsSerializer(
            {
                "current_total": current_total,
                "ROI": opened + finished,
                "ROI_opened": opened,
                "ROI_finished": finished,
            }
        )

        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def report(self, request: Request) -> Response:
        filterset = AssetReportFilterSet(data=request.GET, queryset=self.get_queryset())
        serializer = AssetReportSerializer(filterset.qs, many=True)
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False, permission_classes=(CeiPermission,))
    @celery_task_endpoint(task=sync_cei_transactions_task)
    def sync_cei_transactions(self, _: Request, task_id: str) -> Response:
        return Response({"task_id": task_id}, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False, permission_classes=(CeiPermission,))
    @celery_task_endpoint(task=sync_cei_passive_incomes_task)
    def sync_cei_passive_incomes(self, _: Request, task_id: str) -> Response:
        return Response({"task_id": task_id}, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False, permission_classes=(KuCoinPermission,))
    @celery_task_endpoint(task=sync_kucoin_transactions_task)
    def sync_kucoin_transactions(self, _: Request, task_id: str) -> Response:
        return Response({"task_id": task_id}, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False, permission_classes=(BinancePermission,))
    @celery_task_endpoint(task=sync_binance_transactions_task)
    def sync_binance_transactions(self, _: Request, task_id: str) -> Response:
        return Response({"task_id": task_id}, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False, permission_classes=(AssetsPricesPermission,))
    @celery_task_endpoint(task_name="fetch_current_assets_prices")
    def fetch_current_prices(self, request: Request, task_id: str) -> Response:
        filterset = AssetFetchCurrentPriceFilterSet(
            data=request.GET, queryset=self.get_queryset().opened()
        )
        fetch_current_assets_prices.apply_async(
            task_id=task_id,
            kwargs={
                "username": request.user.username,
                "codes": list(filterset.qs.values_list("code", flat=True)),
            },
        )
        return Response({"task_id": task_id}, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def sync_all(self, request: Request) -> Response:
        TASK_USER_PROPERTY_MAP = {
            "has_cei_integration": (sync_cei_transactions_task, sync_cei_passive_incomes_task),
            "has_kucoin_integration": (sync_kucoin_transactions_task,),
            "has_binance_integration": (sync_binance_transactions_task,),
            "has_asset_price_integration": (fetch_current_assets_prices,),
        }

        response = {}
        kwargs = {"username": request.user.username}
        qs = self.get_queryset()
        for property_name, tasks in TASK_USER_PROPERTY_MAP.items():
            if getattr(request.user, property_name):
                for task in tasks:
                    task_id = start_celery_task(task_name=task.name, user=request.user)
                    task.apply_async(
                        task_id=task_id,
                        kwargs={**kwargs, **task.get_extra_kwargs_from_queryset(queryset=qs)},
                    )
                    response[task.name] = task_id
        return Response(response, status=HTTP_200_OK)


class PassiveIncomeViewSet(ModelViewSet):
    serializer_class = PassiveIncomeSerializer

    def get_queryset(self) -> QuerySet[PassiveIncome]:
        return (
            PassiveIncome.objects.filter(asset__user=self.request.user)
            if self.request.user.is_authenticated
            else PassiveIncome.objects.none()  # drf-spectatular
        )

    @action(methods=("GET",), detail=False)
    def indicators(self, _: Request) -> Response:
        today = timezone.now().date()
        qs = self.get_queryset()
        credited_total = (
            qs.filter_by_month_and_year(month=today.month, year=today.year)
            .credited()
            .sum()["total"]
        )
        provisioned_total = qs.provisioned().sum()["total"]
        serializer = PassiveIncomesIndicatorsSerializer(
            {
                "total": credited_total + provisioned_total,
                "credited_total": credited_total,
                "provisioned_total": provisioned_total,
                "diff_percentage": qs.credited().indicators()[0]["diff_percentage"],
            }
        )

        return Response(serializer.data, status=HTTP_200_OK)
