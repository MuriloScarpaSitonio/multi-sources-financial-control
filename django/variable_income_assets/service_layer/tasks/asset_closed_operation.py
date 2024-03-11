from datetime import datetime

from django.utils import timezone

from ...models import Asset, AssetClosedOperation, PassiveIncome, Transaction
from .exceptions import AssetOpenedException


# TODO: UoW?!
def create(asset_pk: int) -> AssetClosedOperation:
    if not Asset.objects.closed().filter(pk=asset_pk).exists():
        # provavelmente pq uma transacao foi criada logo após o ativo ser fechado
        # manter isso sempre de forma síncrona?!
        raise AssetOpenedException(asset_pk)

    default_filters = {"asset_id": asset_pk}
    if last_finished_operation_datetime := (
        AssetClosedOperation.objects.filter(**default_filters)
        .order_by("-operation_datetime")
        .values_list("operation_datetime", flat=True)
        .first()
    ):
        # hipótese aceita como verdade:
        # um ativo nao será fechado no dia X e recomprado no mesmo dia X
        # (se quebrar relativamente menos problematico pois espera-se que isso rode sync)
        default_filters["operation_date__gt"] = last_finished_operation_datetime.date()

    transactions = Transaction.objects.filter(**default_filters)
    incomes = PassiveIncome.objects.filter(**default_filters)
    return AssetClosedOperation.objects.create(
        asset_id=asset_pk,
        operation_datetime=timezone.make_aware(
            datetime.combine(
                transactions.order_by("-operation_date")
                .values_list("operation_date", flat=True)
                .first(),
                datetime.min.time(),
            )
        ),
        **incomes.aggregate_credited_totals(),
        **transactions.aggregate_normalized_totals(),
    )
