from datetime import date, datetime
from decimal import Decimal


class Revenue:
    def __init__(
        self, *, value: Decimal, description: str, created_at: date = datetime.now().date()
    ):
        self.value = value
        self.description = description
        self.created_at = created_at
