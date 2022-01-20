from django.db.transaction import atomic

from requests.models import Response

from authentication.models import CustomUser
from tasks.models import TaskHistory

from .serializers import CryptoTransactionAlreadyExistsException, CryptoTransactionSerializer
from ..choices import AssetTypes
from ..models import Asset


@atomic
def save_crypto_transactions(
    response: Response, user: CustomUser, task_history: TaskHistory
) -> None:
    assets = dict()
    for data in response.json():
        code = data.pop("code")
        serializer = CryptoTransactionSerializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except CryptoTransactionAlreadyExistsException:
            continue

        asset = assets.get(code)
        if asset is None:
            asset, _ = Asset.objects.get_or_create(
                user=user,
                code=code,
                type=AssetTypes.crypto,
            )

        serializer.create(asset=asset, task_history=task_history)
