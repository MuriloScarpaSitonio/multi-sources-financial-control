from datetime import date as date_typing
from functools import cached_property
from typing import Any, Dict, List, Optional

from cei_crawler import CeiCrawler as PyCeiCrawler
from cryptography.fernet import Fernet

from .settings import FERNET_KEY
from .database.models import User


async def decrypt(value: bytes) -> str:
    decrypted_value = Fernet(FERNET_KEY).decrypt(token=value)
    return str(decrypted_value, "utf-8")


class CeiCrawler:
    def __init__(self, user: User) -> None:
        self.user = user

    @property
    async def crawler(self) -> PyCeiCrawler:
        return PyCeiCrawler(username=self.username, password=await self.password)

    @property
    def username(self):
        return self.user.cpf

    @cached_property
    async def password(self):
        return await decrypt(value=self.user.cei_password)

    async def get_assets(
        self,
        start_date: Optional[date_typing] = None,
        end_date: Optional[date_typing] = None,
    ) -> List[Dict[str, Any]]:
        response = await self.crawler.get_assets_extract(
            start_date=start_date, end_date=end_date, as_dict=True
        )
        await self.crawler.close()

        return response

    async def get_passive_incomes(
        self, date: Optional[date_typing] = None
    ) -> List[Dict[str, Any]]:
        response = await self.crawler.get_passive_incomes_extract(
            date=date, as_dict=True
        )
        await self.crawler.close()

        return response
