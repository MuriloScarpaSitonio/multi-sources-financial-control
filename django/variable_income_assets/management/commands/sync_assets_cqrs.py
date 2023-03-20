from typing import TYPE_CHECKING

from django.core.management.base import BaseCommand, CommandParser

from variable_income_assets.models import Asset
from variable_income_assets.tasks import upsert_asset_read_model

if TYPE_CHECKING:
    from django.core.management.base import CommandParser


class Command(BaseCommand):  # pragma: no cover
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("user_ids", nargs="+", type=int)

    def handle(self, *_, **options):
        for asset_id in Asset.objects.filter(user_id__in=options["user_ids"]).values_list(
            "pk", flat=True
        ):
            upsert_asset_read_model(asset_id=asset_id)
