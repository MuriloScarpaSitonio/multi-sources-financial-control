from datetime import date as date_typing
from functools import cached_property
from typing import Any, Dict, List, Optional

from cei_crawler import CeiCrawler as PyCeiCrawler

from ..database.models import User
from ..database.utils import decrypt


class CeiCrawler:
    def __init__(self, user: User) -> None:
        self.username = user.secrets.cpf
        self.password = decrypt(value=user.secrets.cei_password)

    async def __aenter__(self) -> "CeiCrawler":
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self.crawler.close()

    @cached_property
    def crawler(self) -> PyCeiCrawler:
        return PyCeiCrawler(username=self.username, password=self.password)

    async def get_assets(
        self,
        start_date: Optional[date_typing] = None,
        end_date: Optional[date_typing] = None,
    ) -> List[Dict[str, Any]]:
        return await self.crawler.get_assets_extract(
            start_date=start_date, end_date=end_date, as_dict=True
        )

    async def get_passive_incomes(self, date: Optional[date_typing] = None) -> List[Dict[str, Any]]:
        return await self.crawler.get_passive_incomes_extract(date=date, as_dict=True)
