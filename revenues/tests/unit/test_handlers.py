from decimal import Decimal

from src.domain.commands import CreateRevenue
from src.adapters.repository import AbstractCommandRepository
from src.service_layer import messagebus
from src.service_layer.unit_of_work import AbstractUnitOfWork


class FakeRepository(AbstractCommandRepository):
    def __init__(self, user_id: int, revenues) -> None:
        super().__init__(user_id=user_id)
        self._revenues = set(revenues)

    def _add(self, revenue):
        self._revenues.add(revenue)

    def delete(self, revenue_id):
        pass


class FakeUnitOfWork(AbstractUnitOfWork):
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.revenues = FakeRepository(user_id=user_id, revenues=[])
        self.committed = False

    def _commit(self):
        self.committed = True

    def rollback(self):
        pass


def test_create_revenue(mocker):
    # GIVEN
    data = {"value": Decimal("10"), "description": "Revenue 01"}
    mock_send_mail = mocker.patch("src.service_layer.handlers.send_email")
    mock_agilize_client = mocker.patch("src.service_layer.handlers.agilize_client")

    # WHEN
    messagebus.handle(
        message=CreateRevenue(**data),
        uow=FakeUnitOfWork(user_id=1),
    )

    # THEN
    assert (
        mock_send_mail.call_args[1]["content"]
        == f'Revenue "{data["description"]}" of R${data["value"]} created.'
    )
    assert mock_agilize_client.post.call_args[1]["data"] == data
