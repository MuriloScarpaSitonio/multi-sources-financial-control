from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from dataclasses import dataclass, field


class Command:
    pass


@dataclass
class CreateRevenue(Command):
    value: Decimal
    description: str
    user_id: int
    created_at: date = datetime.now().date()
