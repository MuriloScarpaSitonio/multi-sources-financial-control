from __future__ import annotations

from collections.abc import Iterable
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.db.models import Manager
from django.db.utils import IntegrityError

from rest_framework import serializers

from .domain import commands
from .domain.exceptions import ValidationError as DomainValidationError
from .domain.models import Expense as ExpenseDomainModel
from .models import (
    BankAccount,
    BankAccountSnapshot,
    Expense,
    ExpenseCategory,
    ExpenseSource,
    Revenue,
    RevenueCategory,
)
from .models.abstract import RelatedEntity
from .service_layer import messagebus
from .service_layer.unit_of_work import ExpenseUnitOfWork


class FlatManyToManySerializer(serializers.ListSerializer):
    child = serializers.CharField()
    m2m_field_name = "name"

    def to_internal_value(self, data: Iterable) -> set:
        return set(super().to_internal_value(data))

    def to_representation(self, data: Manager | set) -> list:
        if isinstance(data, Manager):
            return [
                self.child.to_representation(item)
                for item in data.values_list(self.m2m_field_name, flat=True)
            ]
        return super().to_representation(data)


class ExpenseSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    installments = serializers.IntegerField(default=1, write_only=True, allow_null=True)
    tags = FlatManyToManySerializer(required=False)

    class Meta:
        model = Expense
        fields = (
            "id",
            "value",
            "description",
            "category",
            "created_at",
            "source",
            "is_fixed",
            "user",
            "installments",
            "full_description",
            "tags",
        )
        extra_kwargs = {"id": {"read_only": True}, "full_description": {"read_only": True}}

    def create(self, validated_data: dict[str, Any]) -> Expense:
        try:
            user = validated_data.pop("user")
            category = validated_data.pop("category")
            expanded_category = ExpenseCategory.objects.only("id").get(name=category, user=user)
            source = validated_data.pop("source")
            expanded_source = ExpenseSource.objects.only("id").get(name=source, user=user)
            expense = ExpenseDomainModel(
                **validated_data,
                category=category,
                source=source,
                installments_qty=validated_data.pop("installments") or 1,
                extra_data={
                    "expanded_category_id": expanded_category.id,
                    "expanded_source_id": expanded_source.id,
                },
            )
            messagebus.handle(
                message=commands.CreateExpense(
                    expense=expense,
                    perform_actions_on_future_fixed_entities=self.context.get(
                        "perform_actions_on_future_fixed_entities", False
                    ),
                ),
                uow=ExpenseUnitOfWork(user_id=user.id),
            )
            return expense
        except DomainValidationError as exception:
            raise serializers.ValidationError(exception.detail) from exception
        except ExpenseCategory.DoesNotExist as exc:
            raise serializers.ValidationError({"category": "A categoria não existe"}) from exc
        except ExpenseSource.DoesNotExist as e:
            raise serializers.ValidationError({"source": "A fonte não existe"}) from e

    def update(self, instance: Expense, validated_data: dict) -> Expense:
        try:
            extra_data: dict[str, int] = {}

            validated_data.pop("installments")
            user = validated_data.pop("user")
            category = validated_data.pop("category")

            if category != instance.category:
                extra_data["expanded_category_id"] = (
                    ExpenseCategory.objects.only("id").get(name=category, user=user).id
                )

            source = validated_data.pop("source")
            if source != instance.source:
                extra_data["expanded_source_id"] = (
                    ExpenseSource.objects.only("id").get(name=source, user=user).id
                )

            expense = ExpenseDomainModel(
                id=instance.pk,
                category=category,
                source=source,
                installments_id=instance.installments_id,
                installments_qty=instance.installments_qty or 1,
                recurring_id=instance.recurring_id,
                extra_data=extra_data,
                **validated_data,
            )
            expense.validate_update(data_instance=instance)
            messagebus.handle(
                message=commands.UpdateExpense(
                    expense=expense,
                    data_instance=instance,
                    perform_actions_on_future_fixed_entities=self.context.get(
                        "perform_actions_on_future_fixed_entities", False
                    ),
                ),
                uow=ExpenseUnitOfWork(user_id=user.id),
            )
            return expense
        except DomainValidationError as exception:
            raise serializers.ValidationError(exception.detail) from exception
        except ExpenseCategory.DoesNotExist as exc:
            raise serializers.ValidationError({"category": "A categoria não existe"}) from exc
        except ExpenseSource.DoesNotExist as e:
            raise serializers.ValidationError({"source": "A fonte não existe"}) from e


class RevenueSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(
        default=serializers.CurrentUserDefault(),
    )

    class Meta:
        model = Revenue
        fields = (
            "id",
            "value",
            "description",
            "created_at",
            "is_fixed",
            "user",
            "full_description",
            "category",
        )
        extra_kwargs = {
            "id": {"read_only": True},
            "full_description": {"read_only": True},
            "category": {"required": True},
        }


class TotalSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class AvgSerializer(serializers.Serializer):
    avg = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class ExpenseReportCategorySerializer(TotalSerializer):
    category = serializers.CharField()


class ExpenseReportAvgCategorySerializer(ExpenseReportCategorySerializer, AvgSerializer): ...


class ExpenseReportSourceSerializer(TotalSerializer):
    source = serializers.CharField()


class ExpenseReportAvgSourceSerializer(ExpenseReportSourceSerializer, AvgSerializer): ...


class ExpenseReportTypeSerializer(TotalSerializer):
    type = serializers.SerializerMethodField()
    is_fixed = serializers.BooleanField()

    def get_type(self, data: dict[str, bool | Decimal]) -> str:
        return "Fixo" if data["is_fixed"] is True else "Variável"


class ExpenseReportAvgTypeSerializer(ExpenseReportTypeSerializer, AvgSerializer): ...


class ExpenseMonthlyHistoricSerializer(TotalSerializer):
    month = serializers.DateField(format="%d/%m/%Y")


class ExpenseYearlyHistoricSerializer(TotalSerializer):
    year = serializers.DateField(format="%d/%m/%Y")


class MonthlyHistoricResponseSerializer(AvgSerializer, serializers.Serializer):
    historic = ExpenseMonthlyHistoricSerializer(many=True)


class YearlyHistoricResponseSerializer(AvgSerializer, serializers.Serializer):
    historic = ExpenseYearlyHistoricSerializer(many=True)


class PersonalFinancesIndicatorsSerializer(TotalSerializer, AvgSerializer):
    diff = serializers.DecimalField(max_digits=8, decimal_places=2, rounding=ROUND_HALF_UP)
    future = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)



class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = ("amount", "description", "updated_at")
        extra_kwargs = {"updated_at": {"read_only": True}}


class _ExpenseRelatedEntitySerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model: RelatedEntity

        fields = ("id", "user", "name", "hex_color")
        extra_kwargs = {"id": {"read_only": True}}

    def get_unique_together_validators(self):
        return []  # this is being handled in the save method already

    def create(self, validated_data: dict) -> RelatedEntity:
        if entity := self.Meta.model.objects.filter(
            user=self.validated_data["user"], name=self.validated_data["name"], deleted=True
        ).first():
            entity.deleted = False
            entity.hex_color = self.validated_data["hex_color"]
            entity.save(update_fields=("deleted", "hex_color"))
            return entity
        return super().create(validated_data)

    def update(self, instance: RelatedEntity, validated_data: dict) -> RelatedEntity:
        if instance.name != validated_data["name"] and (
            entity := self.Meta.model.objects.filter(
                user=validated_data["user"], name=validated_data["name"], deleted=True
            ).first()
        ):
            entity.deleted = False
            entity.hex_color = validated_data["hex_color"]
            entity.name = validated_data["name"]
            entity.save(update_fields=("deleted", "hex_color", "name"))

            instance.deleted = True
            instance.save(update_fields=("deleted",))
            return entity

        return super().update(instance, validated_data)

    def save(self, **kwargs):
        try:
            return super().save(**kwargs)
        except IntegrityError as e:
            raise serializers.ValidationError({"name": "Os nomes precisam ser únicos"}) from e


class ExpenseCategorySerializer(_ExpenseRelatedEntitySerializer):
    class Meta(_ExpenseRelatedEntitySerializer.Meta):
        model = ExpenseCategory


class ExpenseSourceSerializer(_ExpenseRelatedEntitySerializer):
    class Meta(_ExpenseRelatedEntitySerializer.Meta):
        model = ExpenseSource


class RevenueCategorySerializer(_ExpenseRelatedEntitySerializer):
    class Meta(_ExpenseRelatedEntitySerializer.Meta):
        model = RevenueCategory


class BankAccountSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccountSnapshot
        fields = ("operation_date", "total")
