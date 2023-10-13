from tasks.models import TaskHistory

from ..helpers import TransactionsIntegrationOrchestrator
from .client import BinanceClient
from .schemas import BinanceTransaction


async def sync_binance_transactions(user_id: int) -> Exception | None:
    t = await TaskHistory.objects.acreate(
        name="sync_binance_transactions_task", created_by_id=user_id
    )
    await t.start()

    notification_display_text, exc = await TransactionsIntegrationOrchestrator(
        client_class=BinanceClient, integration_model_class=BinanceTransaction, user_id=user_id
    ).sync()

    await t.finish(exc=exc, notification_display_text=notification_display_text)
    return exc
