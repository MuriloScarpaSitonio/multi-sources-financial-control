from __future__ import annotations

from typing import TYPE_CHECKING

from django.core.management.base import BaseCommand

from variable_income_assets.scripts import print_irpf_infos

if TYPE_CHECKING:  # pragma: no cover
    from django.core.management.base import CommandParser




class Command(BaseCommand):  # pragma: no cover
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--user-id", type=int, required=True)

    def handle(self, **options):
        print_irpf_infos(options["user_id"], debug=options["verbosity"])
