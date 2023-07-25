from dataclasses import dataclass

from ..models import Transaction
from .models import Asset as AssetDomainModel


class Command:
    pass


@dataclass
class CreateTransactions(Command):
    asset: AssetDomainModel
    dispatch_event: bool = True


@dataclass
class UpdateTransaction(Command):
    transaction: Transaction
    asset: AssetDomainModel


@dataclass
class DeleteTransaction(Command):
    transaction: Transaction
    asset: AssetDomainModel
