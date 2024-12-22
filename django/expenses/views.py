from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, ClassVar, Literal
from uuid import uuid4

from django.db.models import Max
from django.db.transaction import atomic

from djchoices.choices import ChoiceItem
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.mixins import (
    CreateModelMixin,
    DestroyModelMixin,
    ListModelMixin,
    UpdateModelMixin,
)
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.utils.serializer_helpers import ReturnList
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from shared.permissions import SubscriptionEndedPermission
from shared.utils import insert_zeros_if_no_data_in_monthly_historic_data

from . import filters, serializers
from .choices import ExpenseReportType
from .domain import commands, events
from .domain.exceptions import OnlyUpdateFixedRevenueDateWithinMonthException
from .domain.models import Revenue as RevenueDomainModel
from .managers import ExpenseQueryset, RevenueQueryset
from .models import BankAccount, Expense, ExpenseCategory, ExpenseSource, Revenue, RevenueCategory
from .permissions import PersonalFinancesModulePermission
from .service_layer import messagebus
from .service_layer.unit_of_work import ExpenseUnitOfWork, RevenueUnitOfWork

if TYPE_CHECKING:
    from django_filters.filterset import FilterSet
    from rest_framework.request import Request
    from rest_framework.serializers import Serializer


class _PersonalFinanceViewSet(
    CreateModelMixin, UpdateModelMixin, DestroyModelMixin, ListModelMixin, GenericViewSet
):
    historic_filterset_class: ClassVar[FilterSet]
    indicators_serializer_class: ClassVar[Serializer]
    permission_classes = (SubscriptionEndedPermission, PersonalFinancesModulePermission)
    ordering_fields = ("created_at", "value")

    def get_serializer_context(self):
        filterset = filters.PersonalFinanceContextFilterSet(
            data=self.request.GET, queryset=self.get_queryset()
        )
        return {**super().get_serializer_context(), **filterset.get_cleaned_data()}

    @action(methods=("GET",), detail=False)
    def historic(self, request: Request) -> Response:
        filterset = self.historic_filterset_class(data=request.GET, queryset=self.get_queryset())
        serializer = serializers.HistoricResponseSerializer(
            {
                "historic": insert_zeros_if_no_data_in_monthly_historic_data(
                    historic=list(filterset.qs.trunc_months().order_by("month"))
                ),
                **filterset.qs.monthly_avg(),
            }
        )
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def historic_report(self, request: Request) -> Response:
        filterset = filters.ExpenseHistoricV2FilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        qs = filterset.qs
        serializer = serializers.HistoricResponseSerializer(
            {
                "historic": insert_zeros_if_no_data_in_monthly_historic_data(
                    historic=list(qs.trunc_months().order_by("month"))
                ),
                **qs.monthly_avg(),
            }
        )
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def indicators(self, _: Request) -> Response:
        qs = self.get_queryset().indicators()
        # TODO: do this via SQL
        percentage = (
            (((qs["total"] / qs["avg"]) - Decimal("1.0")) * Decimal("100.0"))
            if qs["avg"]
            else Decimal()
        )

        serializer = self.indicators_serializer_class({**qs, "diff": percentage})
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def sum(self, request: Request) -> Response:
        filterset = filters.PersonalFinanceIndicatorsV2FilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        return Response(serializers.TotalSerializer(filterset.qs.sum()).data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def avg(self, _: Request) -> Response:
        return Response(
            serializers.AvgSerializer(self.get_queryset().since_a_year_ago_avg()).data,
            status=HTTP_200_OK,
        )

    @action(methods=("GET",), detail=False)
    def higher_value(self, request: Request) -> Response:
        filterset = filters.PersonalFinanceIndicatorsV2FilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        entity = filterset.qs.annotate(max_value=Max("value")).order_by("-max_value").first()
        return Response(self.serializer_class(entity).data, status=HTTP_200_OK)


class ExpenseViewSet(_PersonalFinanceViewSet):
    filterset_class = filters.ExpenseFilterSet
    historic_filterset_class = filters.ExpenseHistoricFilterSet
    serializer_class = serializers.ExpenseSerializer
    indicators_serializer_class = serializers.ExpenseIndicatorsSerializer

    def get_queryset(self) -> ExpenseQueryset[Expense]:
        return (
            self.request.user.expenses.all().order_by("-created_at")
            if self.request.user.is_authenticated
            else Expense.objects.none()  # pragma: no cover -- drf-spectatular
        )

    def perform_destroy(self, instance: Expense) -> None:
        context = self.get_serializer_context()
        messagebus.handle(
            message=commands.DeleteExpense(
                expense=instance.to_domain(),
                perform_actions_on_future_fixed_entities=context.get(
                    "perform_actions_on_future_fixed_entities", False
                ),
            ),
            uow=ExpenseUnitOfWork(user_id=self.request.user.id),
        )

    @staticmethod
    def _get_report_serializer_class(choice: ChoiceItem, avg: bool) -> type[Serializer]:
        name = (
            choice.serializer_name.replace("Report", "ReportAvg") if avg else choice.serializer_name
        )
        module = __import__("expenses.serializers", fromlist=[name])
        return getattr(module, name)

    def _get_report_data(
        self, filterset: filters.ExpenseAvgComparasionReportFilterSet, avg: bool
    ) -> ReturnList:
        qs = filterset.qs
        choice = ExpenseReportType.get_choice(value=filterset.form.cleaned_data["group_by"])
        Serializer = self._get_report_serializer_class(choice=choice, avg=avg)
        serializer = Serializer(qs, many=True)
        return serializer.data

    @action(methods=("GET",), detail=False)
    def avg_comparasion_report(self, request: Request) -> Response:
        filterset = filters.ExpenseAvgComparasionReportFilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        return Response(self._get_report_data(filterset=filterset, avg=True), status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def percentage_report(self, request: Request) -> Response:
        filterset = filters.ExpensePercentageReportFilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        return Response(self._get_report_data(filterset=filterset, avg=False), status=HTTP_200_OK)


class RevenueViewSet(_PersonalFinanceViewSet):
    filterset_class = filters.RevenueFilterSet
    historic_filterset_class = filters.RevenueHistoricFilterSet
    serializer_class = serializers.RevenueSerializer
    indicators_serializer_class = serializers.RevenueIndicatorsSerializer

    def get_queryset(self) -> RevenueQueryset[Revenue]:
        return (
            self.request.user.revenues.all().order_by("-created_at")
            if self.request.user.is_authenticated
            else Expense.objects.none()  # pragma: no cover -- drf-spectatular
        )

    def _get_expanded_category_id(self, category: str) -> int:
        try:
            return RevenueCategory.objects.only("id").get(name=category, user=self.request.user).id
        except RevenueCategory.DoesNotExist as exc:
            raise ValidationError({"category": "A categoria não existe"}) from exc

    @atomic
    def perform_create(self, serializer: serializers.RevenueSerializer) -> None:
        # TODO move to service layer
        expanded_category_id = self._get_expanded_category_id(
            category=serializer.validated_data["category"]
        )

        revenue: RevenueDomainModel = serializer.save(
            recurring_id=uuid4() if serializer.validated_data.get("is_fixed", False) else None,
            expanded_category_id=expanded_category_id,
        ).to_domain()
        if revenue.is_fixed and serializer.context.get(
            "perform_actions_on_future_fixed_entities", False
        ):
            messagebus.handle(
                message=commands.CreateFutureFixedRevenues(revenue=revenue),
                uow=RevenueUnitOfWork(user_id=self.request.user.id),
            )

        if revenue.is_current_month:
            messagebus.handle(
                message=events.RevenueCreated(value=serializer.instance.value),
                uow=RevenueUnitOfWork(user_id=self.request.user.id),
            )

    @atomic
    def perform_update(self, serializer: serializers.RevenueSerializer) -> None:
        # TODO: move to domain layer & service layer
        prev_value = serializer.instance.value
        prev_created_at = serializer.instance.created_at
        prev_recurring_id = serializer.instance.recurring_id
        to_fixed = serializer.validated_data.get("is_fixed", False)
        to_created_at = serializer.validated_data["created_at"]
        from_not_fixed_to_fixed = not serializer.instance.is_fixed and to_fixed
        from_fixed_to_not_fixed = serializer.instance.is_fixed and not to_fixed
        perform_on_future = serializer.context.get(
            "perform_actions_on_future_fixed_entities", False
        )
        if to_fixed and (
            to_created_at.month != prev_created_at.month
            or to_created_at.year != prev_created_at.year
        ):
            e = OnlyUpdateFixedRevenueDateWithinMonthException()
            raise ValidationError(e.detail)

        kwargs = {}
        if serializer.instance.category != serializer.validated_data["category"]:
            kwargs["expanded_category_id"] = self._get_expanded_category_id(
                category=serializer.validated_data["category"]
            )
        if from_not_fixed_to_fixed:
            kwargs["recurring_id"] = uuid4()
        elif from_fixed_to_not_fixed:
            kwargs["recurring_id"] = None

        revenue: RevenueDomainModel = serializer.save(**kwargs).to_domain()
        uow = RevenueUnitOfWork(user_id=self.request.user.id)
        if (
            revenue.recurring_id is not None
            and revenue.is_fixed
            and perform_on_future
            and not revenue.is_past_month
        ):
            messagebus.handle(
                message=commands.UpdateFutureFixedRevenues(
                    revenue=revenue, created_at_changed=prev_created_at != revenue.created_at
                ),
                uow=uow,
            )

        if from_not_fixed_to_fixed and perform_on_future and not revenue.is_past_month:
            messagebus.handle(message=commands.CreateFutureFixedRevenues(revenue=revenue), uow=uow)

        if from_fixed_to_not_fixed and perform_on_future and not revenue.is_past_month:
            # as we have removed the `recurring_id` we need to set it back so we can find
            # the related revenues
            revenue.recurring_id = prev_recurring_id
            messagebus.handle(message=commands.DeleteFutureFixedRevenues(revenue=revenue), uow=uow)

        if revenue.is_current_month:
            messagebus.handle(
                message=events.RevenueUpdated(diff=prev_value - serializer.instance.value),
                uow=uow,
            )

    @atomic
    def perform_destroy(self, instance: Revenue):
        # TODO move to service layer
        revenue = instance.to_domain()
        instance.delete()

        if (
            self.get_serializer_context().get("perform_actions_on_future_fixed_entities", False)
            and not revenue.is_past_month
        ):
            messagebus.handle(
                message=commands.DeleteFutureFixedRevenues(revenue=revenue),
                uow=RevenueUnitOfWork(user_id=self.request.user.id),
            )

        if revenue.is_current_month:
            messagebus.handle(
                message=events.RevenueDeleted(value=revenue.value),
                uow=RevenueUnitOfWork(user_id=self.request.user.id),
            )


class BankAccountView(APIView):
    permission_classes = (SubscriptionEndedPermission, PersonalFinancesModulePermission)

    def get_object(self) -> BankAccount:
        return get_object_or_404(BankAccount.objects.all(), user_id=self.request.user.id)

    def get(self, _: Request) -> Response:
        return Response(
            data=serializers.BankAccountSerializer(instance=self.get_object()).data,
            status=HTTP_200_OK,
        )

    def put(self, request: Request) -> Response:
        serializer = serializers.BankAccountSerializer(
            instance=self.get_object(), data=request.data
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(data=serializer.data, status=HTTP_200_OK)


class _ExpenseRelatedEntityViewSet(
    GenericViewSet, ListModelMixin, UpdateModelMixin, DestroyModelMixin, CreateModelMixin
):
    permission_classes = (SubscriptionEndedPermission, PersonalFinancesModulePermission)
    ordering_fields = ("num_of_appearances", "name")
    ordering = ("-created_at",)
    filter_backends = (filters.MostCommonOrderingFilterBackend,)

    expense_field: ClassVar[Literal["category", "source"]]
    model: ClassVar[type[ExpenseCategory] | type[ExpenseSource]]
    entity_updated_event_class: ClassVar[events.RelatedExpenseEntityUpdated]

    def get_related_queryset(self) -> ExpenseQueryset[Expense]:
        return Expense.objects.filter(user_id=self.request.user.id)

    def get_queryset(self):
        return (
            self.model.objects.only("id", "name", "hex_color").filter(
                user_id=self.request.user.id, deleted=False
            )
            if self.request.user.is_authenticated
            else self.model.objects.none()  # pragma: no cover -- drf-spectatular
        )

    def perform_update(self, serializer: serializers.serializers.Serializer) -> None:
        prev_name = serializer.instance.name
        instance = serializer.save()
        if prev_name != instance.name:
            with ExpenseUnitOfWork(user_id=self.request.user.id) as uow:
                messagebus.handle(
                    message=self.entity_updated_event_class(
                        prev_name=prev_name, name=instance.name
                    ),
                    uow=uow,
                )

    @action(methods=("GET",), detail=False)
    def most_common(self, _: Request) -> Response:
        entity = (
            self.get_related_queryset()
            .most_common(self.expense_field)
            .as_related_entities(self.expense_field)
            .first()
        )
        return Response(self.serializer_class(entity).data, status=HTTP_200_OK)

    def perform_destroy(self, instance: ExpenseCategory | ExpenseSource) -> None:
        instance.deleted = True
        instance.save(update_fields=("deleted",))


class ExpenseCategoryViewSet(_ExpenseRelatedEntityViewSet):
    expense_field = "category"
    model = ExpenseCategory
    serializer_class = serializers.ExpenseCategorySerializer
    entity_updated_event_class = events.ExpenseCategoryUpdated


class ExpenseSourceViewSet(_ExpenseRelatedEntityViewSet):
    expense_field = "source"
    model = ExpenseSource
    serializer_class = serializers.ExpenseSourceSerializer
    entity_updated_event_class = events.ExpenseSourceUpdated


class RevenueCategoryViewSet(
    GenericViewSet, ListModelMixin, UpdateModelMixin, DestroyModelMixin, CreateModelMixin
):
    permission_classes = (SubscriptionEndedPermission, PersonalFinancesModulePermission)
    ordering_fields = ("num_of_appearances", "name")
    ordering = ("-created_at",)
    filter_backends = (filters.MostCommonOrderingFilterBackend,)
    serializer_class = serializers.RevenueCategorySerializer

    def get_related_queryset(self) -> RevenueQueryset[Revenue]:
        return Revenue.objects.filter(user_id=self.request.user.id)

    def get_queryset(self):
        return (
            RevenueCategory.objects.only("id", "name", "hex_color").filter(
                user_id=self.request.user.id, deleted=False
            )
            if self.request.user.is_authenticated
            else RevenueCategory.objects.none()  # pragma: no cover -- drf-spectatular
        )

    def perform_update(self, serializer: serializers.serializers.Serializer) -> None:
        prev_name = serializer.instance.name
        instance = serializer.save()
        if prev_name != instance.name:
            with RevenueUnitOfWork(user_id=self.request.user.id) as uow:
                messagebus.handle(
                    message=events.RevenueCategoryUpdated(prev_name=prev_name, name=instance.name),
                    uow=uow,
                )

    @action(methods=("GET",), detail=False)
    def most_common(self, _: Request) -> Response:
        entity = self.get_related_queryset().most_common().as_related_entities().first()
        return Response(self.serializer_class(entity).data, status=HTTP_200_OK)

    def perform_destroy(self, instance: RevenueCategory) -> None:
        instance.deleted = True
        instance.save(update_fields=("deleted",))
