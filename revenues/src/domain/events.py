from dataclasses import dataclass
from decimal import Decimal


class Event:
    pass


@dataclass
class RevenueCreated(Event):
    value: Decimal
    description: str
