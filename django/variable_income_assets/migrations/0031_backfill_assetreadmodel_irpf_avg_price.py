from decimal import Decimal

from django.db import migrations
from django.db.models import F, Sum, Value
from django.db.models.functions import Coalesce


def backfill_irpf_avg_price(apps, schema_editor):
    AssetClosedOperation = apps.get_model("variable_income_assets", "AssetClosedOperation")
    AssetMetaData = apps.get_model("variable_income_assets", "AssetMetaData")
    AssetReadModel = apps.get_model("variable_income_assets", "AssetReadModel")
    Transaction = apps.get_model("variable_income_assets", "Transaction")

    quantity = Coalesce(F("quantity"), Value(Decimal("1.0")))
    last_pk = 0

    while read_models := list(
        AssetReadModel.objects.filter(pk__gt=last_pk)
        .only("pk", "write_model_pk", "avg_price")
        .order_by("pk")[:500]
    ):
        asset_ids = [read_model.write_model_pk for read_model in read_models]
        self_custody_asset_ids = set(
            AssetMetaData.objects.filter(asset_id__in=asset_ids).values_list("asset_id", flat=True)
        )
        acquisitions_by_asset = {
            row["asset_id"]: row
            for row in Transaction.objects.filter(
                asset_id__in=asset_ids,
                action__in=("BUY", "BONIFICACAO"),
            )
            .values("asset_id")
            .annotate(
                total=Sum(F("irpf_price") * quantity, default=Decimal()),
                quantity=Sum(quantity, default=Decimal()),
            )
        }
        closed_operations_by_asset = {
            row["asset_id"]: row
            for row in AssetClosedOperation.objects.filter(asset_id__in=asset_ids)
            .values("asset_id")
            .annotate(
                total=Sum("irpf_total_bought", default=Decimal()),
                quantity=Sum("quantity_bought", default=Decimal()),
            )
        }

        for read_model in read_models:
            if read_model.write_model_pk in self_custody_asset_ids:
                irpf_avg_price = read_model.avg_price
            else:
                acquisitions = acquisitions_by_asset.get(
                    read_model.write_model_pk,
                    {"total": Decimal(), "quantity": Decimal()},
                )
                closed_operations = closed_operations_by_asset.get(
                    read_model.write_model_pk,
                    {"total": Decimal(), "quantity": Decimal()},
                )
                current_total = acquisitions["total"] - closed_operations["total"]
                current_quantity = acquisitions["quantity"] - closed_operations["quantity"]
                irpf_avg_price = current_total / max(current_quantity, Decimal("1.0"))

            read_model.irpf_avg_price = irpf_avg_price

        AssetReadModel.objects.bulk_update(read_models, ("irpf_avg_price",), batch_size=500)
        last_pk = read_models[-1].pk


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("variable_income_assets", "0030_assetreadmodel_irpf_avg_price"),
    ]

    operations = [
        migrations.RunPython(backfill_irpf_avg_price, migrations.RunPython.noop),
    ]
