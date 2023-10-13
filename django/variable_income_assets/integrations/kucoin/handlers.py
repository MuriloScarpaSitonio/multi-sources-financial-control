from tasks.models import TaskHistory

from ..helpers import TransactionsIntegrationOrchestrator
from .client import KuCoinClient
from .schemas import KuCoinTransaction


async def sync_kucoin_transactions(user_id: int) -> Exception | None:
    t = await TaskHistory.objects.acreate(
        name="sync_kucoin_transactions_task", created_by_id=user_id
    )
    await t.start()

    notification_display_text, exc = await TransactionsIntegrationOrchestrator(
        client_class=KuCoinClient, integration_model_class=KuCoinTransaction, user_id=user_id
    ).sync()

    await t.finish(exc=exc, notification_display_text=notification_display_text)
    return exc
