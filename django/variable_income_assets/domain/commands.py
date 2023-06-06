from dataclasses import dataclass

from .models import Asset as AssetDomainModel
from ..models import Transaction


class Command:
    pass


@dataclass
class CreateTransactions(Command):
    asset: AssetDomainModel
    new_asset: bool = False


@dataclass
class UpdateTransaction(Command):
    transaction: Transaction
    asset: AssetDomainModel


@dataclass
class DeleteTransaction(Command):
    transaction: Transaction
    asset: AssetDomainModel
