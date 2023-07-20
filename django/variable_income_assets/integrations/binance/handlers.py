from tasks.models import TaskHistory

from ..decorators import qstash_user_task
from ..helpers import TransactionsIntegrationOrchestrator
from .client import BinanceClient
from .schemas import BinanceTransaction


@qstash_user_task
async def sync_binance_transactions(task_history_id: str, user_id: int) -> Exception | None:
    t: TaskHistory = await TaskHistory.objects.aget(pk=task_history_id)
    await t.start()

    notification_display_text, error = await TransactionsIntegrationOrchestrator(
        client_class=BinanceClient, integration_model_class=BinanceTransaction, user_id=user_id
    ).sync()

    await t.finish(error=error, notification_display_text=notification_display_text)
    return error
