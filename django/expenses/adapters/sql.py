from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from django.db.models import F

from dateutil.relativedelta import relativedelta

from ..domain.models import Expense as ExpenseDTO
from ..domain.models import Revenue as RevenueDTO

if TYPE_CHECKING:
    from ..domain.models import Expense as ExpenseDomainModel
    from ..models import Expense, Revenue

    Entity = Expense | Revenue
    EntityDTO = ExpenseDTO | RevenueDTO


class AbstractEntityRepository(ABC):
    def __init__(self, user_id: int) -> None:
        self.user_id = user_id
        self.seen: set[Entity] = set()

    def add(self, dto: EntityDTO) -> None:
        self.seen.add(dto)
        self._add(dto=dto)

    @abstractmethod
    def _add(self, dto: EntityDTO) -> None:
        raise NotImplementedError

    def update(self, dto: EntityDTO) -> None:
        self.seen.add(dto)
        self._update(dto=dto)

    @abstractmethod
    def _update(self, dto: EntityDTO) -> None:
        raise NotImplementedError

    def delete(self, dto: EntityDTO) -> None:
        self.seen.add(dto)
        self._delete(dto=dto)

    @abstractmethod
    def _delete(self, entity: Entity) -> None:
        raise NotImplementedError


class AbstractExpenseRepository(AbstractEntityRepository):
    def add_installments(self, dto: ExpenseDTO) -> None:
        dto.installments_id = uuid4()
        self.seen.add(dto)
        self._add_installments(dto=dto)

    @abstractmethod
    def _add_installments(self, dto: ExpenseDTO) -> None:
        raise NotImplementedError

    def update_installments(self, dto: ExpenseDTO, created_at_changed: bool) -> None:
        self.seen.add(dto)
        self._update_installments(dto=dto, created_at_changed=created_at_changed)

    @abstractmethod
    def _update_installments(self, dto: ExpenseDTO, created_at_changed: bool) -> None:
        raise NotImplementedError

    def delete_installments(self, dto: ExpenseDTO) -> None:
        self.seen.add(dto)
        self._delete_installments(dto=dto)

    @abstractmethod
    def _delete_installments(self, dto: ExpenseDTO) -> None:
        raise NotImplementedError

    @abstractmethod
    def add_future_fixed_expenses(self, dto: ExpenseDTO) -> None:
        raise NotImplementedError

    @abstractmethod
    def update_future_fixed_expenses(self, dto: ExpenseDTO, created_at_changed: bool) -> None:
        raise NotImplementedError

    @abstractmethod
    def delete_future_fixed_expenses(self, dto: ExpenseDTO) -> None:
        raise NotImplementedError

    @abstractmethod
    def change_all_categories(self, *, prev_name: str, name: str) -> int:
        raise NotImplementedError

    @abstractmethod
    def change_all_sources(self, *, prev_name: str, name: str) -> int:
        raise NotImplementedError


class ExpenseRepository(AbstractExpenseRepository):
    seen: set[ExpenseDTO]

    def _add(self, dto: ExpenseDTO) -> None:
        from ..models import Expense

        data = asdict(dto)
        data.pop("installments")
        data.pop("installments_id")
        data.pop("installments_qty")
        extra_data = data.pop("extra_data")
        Expense.objects.create(user_id=self.user_id, **data, **extra_data)

    def _add_installments(self, dto: ExpenseDTO) -> list[Expense]:
        from ..models import Expense

        data = asdict(dto)
        data.pop("installments")
        installments = data.pop("installments_qty")
        data["value"] /= installments
        created_at = data.pop("created_at")
        extra_data = data.pop("extra_data")
        return Expense.objects.bulk_create(
            objs=(
                Expense(
                    user_id=self.user_id,
                    created_at=created_at + relativedelta(months=i),
                    installments_qty=installments,
                    installment_number=i + 1,
                    **data,
                    **extra_data,
                )
                for i in range(installments)
            )
        )

    def add_future_fixed_expenses(self, dto: ExpenseDTO) -> list[Expense]:
        from ..models import Expense

        data = asdict(dto)
        data.pop("id")
        data.pop("installments")
        data.pop("installments_qty")
        data.pop("installments_id")

        created_at = data.pop("created_at")
        extra_data = data.pop("extra_data")
        return Expense.objects.bulk_create(
            objs=(
                Expense(
                    user_id=self.user_id,
                    created_at=created_at + relativedelta(months=i),
                    **data,
                    **extra_data,
                )
                for i in range(1, 12)
            )
        )

    def _update(self, dto: ExpenseDTO) -> None:
        from ..models import Expense

        data = asdict(dto)
        data.pop("installments")
        data.pop("installments_id")
        data.pop("installments_qty")
        extra_data = data.pop("extra_data")
        Expense.objects.filter(id=dto.id).update(**data, **extra_data)

    def _update_installments(self, dto: ExpenseDTO, created_at_changed: bool) -> None:
        from ..models import Expense

        data = asdict(dto)
        installments_qs = Expense.objects.filter(installments_id=data.pop("installments_id"))
        if created_at_changed:
            expenses: list[Expense] = []
            for i, expense in enumerate(installments_qs.order_by("created_at")):
                # `releativedelta` doesn't work with django's `F` object so this doesn't work:
                # date_fiff = instance.created_at - validated_data["created_at"]
                # F("created_at") - relativedelta(seconds=int(date_diff.total_seconds()))
                expense.created_at = dto.created_at + relativedelta(months=i)
                expenses.append(expense)

            # TODO try to remove this intermediary query
            Expense.objects.bulk_update(objs=expenses, fields=("created_at",))

        data.pop("installments")
        data.pop("installments_qty")
        data.pop("created_at")
        data.pop("id")
        extra_data = data.pop("extra_data")
        installments_qs.update(**data, **extra_data)

    def _delete(self, dto: ExpenseDTO) -> None:
        from ..models import Expense

        Expense.objects.filter(id=dto.id).delete()

    def update_future_fixed_expenses(self, dto: ExpenseDTO, created_at_changed: bool) -> None:
        from ..models import Expense

        data = asdict(dto)
        created_at = data.pop("created_at")
        recurring_id = data.pop("recurring_id")
        future_qs = Expense.objects.filter(
            recurring_id=recurring_id, created_at__gt=created_at
        ).exclude(id=data.pop("id"))

        if created_at_changed:
            expenses: list[Expense] = []
            for expense in future_qs.order_by("created_at"):
                # `releativedelta` doesn't work with django's `F` object so this doesn't work:
                # date_fiff = instance.created_at - validated_data["created_at"]
                # F("created_at") - relativedelta(seconds=int(date_diff.total_seconds()))
                expense.created_at = expense.created_at.replace(day=created_at.day)
                expenses.append(expense)

            # TODO try to remove this intermediary query
            Expense.objects.bulk_update(objs=expenses, fields=("created_at",))

        data.pop("installments")
        data.pop("installments_id")
        data.pop("installments_qty")
        extra_data = data.pop("extra_data")
        future_qs.update(**data, **extra_data)

    def _delete_installments(self, dto: ExpenseDTO) -> None:
        from ..models import Expense

        Expense.objects.filter(installments_id=dto.installments_id).delete()

    def delete_future_fixed_expenses(self, dto: ExpenseDTO) -> None:
        from ..models import Expense

        Expense.objects.filter(
            recurring_id=dto.recurring_id, created_at__gt=dto.created_at
        ).delete()

    def get_installments(self, id: int, installments_id: UUID | None) -> list[ExpenseDomainModel]:
        from ..models import Expense

        return (
            [
                e.to_domain(include_installments=False)
                for e in Expense.objects.filter(installments_id=installments_id).exclude(pk=id)
            ]
            if installments_id
            else []
        )

    def change_all_categories(self, *, prev_name: str, name: str, new_id: int) -> int:
        from ..models import Expense

        return Expense.objects.filter(user_id=self.user_id, category=prev_name).update(
            category=name, expanded_category_id=new_id
        )

    def change_all_sources(self, *, prev_name: str, name: str, new_id: int) -> int:
        from ..models import Expense

        return Expense.objects.filter(user_id=self.user_id, source=prev_name).update(
            source=name, expanded_source_id=new_id
        )


class AbstractBankAccountRepository(ABC):
    def __init__(self, user_id: int) -> None:
        self.user_id = user_id

    @abstractmethod
    def increment(self, total: Decimal) -> int:
        raise NotImplementedError

    @abstractmethod
    def decrement(self, total: Decimal) -> int:
        raise NotImplementedError


class DjangoBankAccountRepository(AbstractBankAccountRepository):
    def increment(self, value: Decimal) -> None:
        if not value:
            return

        from ..models import BankAccount

        BankAccount.objects.filter(user_id=self.user_id).update(amount=F("amount") + value)

    def decrement(self, value: Decimal) -> None:
        if not value:
            return

        from ..models import BankAccount

        BankAccount.objects.filter(user_id=self.user_id).update(amount=F("amount") - value)


class AbstractRevenueRepository(AbstractEntityRepository):
    def _add(self, *_, **__) -> None:
        ...

    def _update(self, *_, **__) -> None:
        ...

    def _delete(self, *_, **__) -> None:
        ...

    def add_fixed_future_revenues(self, dto: RevenueDTO) -> list[Revenue]:
        raise NotImplementedError

    def update_future_fixed_revenues(self, dto: RevenueDTO, created_at_changed: bool) -> None:
        raise NotImplementedError

    def delete_future_fixed_revenues(self, dto: RevenueDTO) -> None:
        raise NotImplementedError


class RevenueRepository(AbstractRevenueRepository):
    def add_fixed_future_revenues(self, dto: RevenueDTO) -> list[Revenue]:
        from ..models import Revenue

        data = asdict(dto)
        data.pop("id")

        created_at = data.pop("created_at")
        return Revenue.objects.bulk_create(
            objs=(
                Revenue(
                    user_id=self.user_id,
                    created_at=created_at + relativedelta(months=i),
                    **data,
                )
                for i in range(1, 12)
            )
        )

    def update_future_fixed_revenues(self, dto: RevenueDTO, created_at_changed: bool) -> None:
        from ..models import Revenue

        data = asdict(dto)
        created_at = data.pop("created_at")
        recurring_id = data.pop("recurring_id")
        future_qs = Revenue.objects.filter(
            recurring_id=recurring_id, created_at__gt=created_at
        ).exclude(id=data.pop("id"))

        if created_at_changed:
            revenues: list[Revenue] = []
            for revenue in future_qs.order_by("created_at"):
                # `releativedelta` doesn't work with django's `F` object so this doesn't work:
                # date_fiff = instance.created_at - validated_data["created_at"]
                # F("created_at") - relativedelta(seconds=int(date_diff.total_seconds()))
                revenue.created_at = revenue.created_at.replace(day=created_at.day)
                revenues.append(revenue)

            # TODO try to remove this intermediary query
            Revenue.objects.bulk_update(objs=revenues, fields=("created_at",))

        future_qs.update(**data)

    def delete_future_fixed_revenues(self, dto: RevenueDTO) -> None:
        from ..models import Revenue

        Revenue.objects.filter(
            recurring_id=dto.recurring_id, created_at__gt=dto.created_at
        ).delete()

    def change_all_categories(self, *, prev_name: str, name: str, new_id: int = 0) -> int:
        from ..models import Revenue

        return Revenue.objects.filter(user_id=self.user_id, category=prev_name).update(
            category=name, expanded_category_id=new_id
        )
