from functools import partial

from ...models import Expense
from .shared import create_fixed_entities_from_last_month

# TODO: run this every 1st of month for every eligble users
# fixed expenses has credit card as source - so we don't need to decrement bank account
create_fixed_expenses_from_last_month = partial(
    create_fixed_entities_from_last_month, model=Expense
)
