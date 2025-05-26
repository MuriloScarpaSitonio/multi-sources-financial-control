from datetime import date, datetime, timedelta

from authentication.models import CustomUser

from ....choices import AssetTypes, Currencies
from ....domain import commands
from ....domain.models import Asset as AssetDomainModel
from ....service_layer import messagebus
from ....service_layer.unit_of_work import AsyncDjangoUnitOfWork
from ..client import B3Client
from ..models import AssetTrading
from ..utils import camel_to_snake_keys


async def sync_stock_transactions(user: CustomUser):
    async with B3Client() as client:
        async for reference_date, trading_list in client.stream_assets_trading(
            document_number=user.secrets.cpf,
            start_date=date(2019, 11, 1),
            end_date=datetime.now().date() - timedelta(days=8),
            batch_size=40,
        ):
            for t in camel_to_snake_keys(trading_list):
                asset_trading = AssetTrading(**t, reference_date=reference_date)
                if asset_trading.is_skippable():
                    continue

                with AsyncDjangoUnitOfWork(user_id=user.id) as uow:
                    await messagebus.ahandle(
                        message=commands.GetOrCreateAsset(
                            asset=AssetDomainModel(
                                type=AssetTypes.stock,
                                code=t["ticker_symbol"],
                                currency=Currencies.real,
                            ),
                            fetch_is_held_in_self_custody=False,
                        ),
                        uow=uow,
                    )
                    asset_domain = next(iter(uow.assets.seen))
                    asset_domain.add_transaction(asset_trading.as_dto())
                    await messagebus.ahandle(
                        message=commands.AsyncCreateTransaction(asset=asset_domain),
                        uow=uow,
                    )
                print(t)
                print()
