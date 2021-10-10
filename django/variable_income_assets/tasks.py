from typing import Dict, Union

from django.conf import settings
from django.db.transaction import atomic
from django.utils import timezone

import requests
from celery import shared_task

from authentication.models import CustomUser
from shared.utils import build_url
from tasks.bases import TaskWithHistory
from tasks.models import TaskHistory
from variable_income_assets.choices import AssetTypes, TransactionActions
from variable_income_assets.models import Asset, Transaction


def _instantiate_transaction(infos: Dict[str, Union[str, int, float]]) -> Transaction:
    return Transaction(
        action=getattr(TransactionActions, infos["action"]),
        price=infos["unit_price"],
        quantity=infos["unit_amount"],
        created_at=infos["operation_date"],
    )


def _resolve_code(code: str, market_type: str) -> str:
    """Se o ativo é do mercado fracionado, não criamos um asset específico para ele"""
    return code[:-1] if market_type == "fractional_share" else code


def _get_asset(
    assets: Dict[str, Asset], user: CustomUser, code: str, market_type: str
) -> Asset:
    asset = assets.get(code)
    if asset is None:
        asset, _ = Asset.objects.get_or_create(
            user=user,
            code=_resolve_code(code=code, market_type=market_type),
            type=AssetTypes.stock,
        )
        assets[code] = asset
    return asset


@atomic
def _save_cei_transactions(
    response: requests.models.Response, user: CustomUser, task_history: TaskHistory
):
    transactions = []
    assets = dict()
    for asset_transaction in response.json():
        asset = _get_asset(
            assets=assets,
            user=user,
            code=asset_transaction["raw_negotiation_code"],
            market_type=asset_transaction["market_type"],
        )
        transaction = _instantiate_transaction(infos=asset_transaction)
        transaction.asset = asset
        transaction.fetched_by = task_history
        transactions.append(transaction)

    Transaction.objects.bulk_create(objs=transactions)


@shared_task(bind=True, name="cei_assets_crawler", base=TaskWithHistory)
def cei_assets_crawler(self, username: str) -> int:
    url = build_url(
        url=settings.CRAWLERS_URL,
        parts=("cei/", "assets"),
        query_params={
            "username": username,
            "start_date": self.get_last_run(username=username, as_date=True),
            "end_date": timezone.now().date(),
        },
    )
    _save_cei_transactions(
        response=requests.get(url),
        user=CustomUser.objects.get(username=username),
        task_history=TaskHistory.objects.get(pk=self.request.id),
    )
