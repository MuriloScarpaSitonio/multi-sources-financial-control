from tasks.models import TaskHistory

from ..decorators import qstash_user_task
from ..helpers import TransactionsIntegrationOrchestrator
from .client import KuCoinClient
from .schemas import KuCoinTransaction


@qstash_user_task
async def sync_kucoin_transactions(task_history_id: str, user_id: int) -> Exception | None:
    t = await TaskHistory.objects.aget(pk=task_history_id)
    await t.start()

    notification_display_text, error = await TransactionsIntegrationOrchestrator(
        client_class=KuCoinClient, integration_model_class=KuCoinTransaction, user_id=user_id
    ).sync()

    await t.finish(error=error, notification_display_text=notification_display_text)
    return error
