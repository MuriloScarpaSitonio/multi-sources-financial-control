from datetime import date
from decimal import Decimal
from typing import List, Optional


from .events import Event


class Revenue:
    def __init__(self, *, value: Decimal, description: str, created_at: Optional[date] = None):
        self.value = value
        self.description = description
        self.created_at = created_at if created_at is not None else date.today()

        self.events: List[Event] = []
