from datetime import date
from decimal import Decimal
from typing import List


from .events import Event


class Revenue:
    def __init__(self, *, value: Decimal, description: str, created_at: date = date.today()):
        self.value = value
        self.description = description
        self.created_at = created_at

        self.events: List[Event] = []
