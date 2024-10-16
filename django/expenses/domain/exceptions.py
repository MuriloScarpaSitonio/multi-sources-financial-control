class ValidationError(Exception):
    default_message: str | None = None

    def __init__(
        self,
        *,
        field: str,
        message: str | None = None,
        message_interpolation_params: dict[str, str] | None = None,
    ) -> None:
        if message is not None:
            self.message = message  # pragma: no cover
        else:
            self.message = (
                self.default_message % message_interpolation_params
                if message_interpolation_params is not None
                else self.default_message
            )
        self.field = field
        super().__init__(self.message)

    @property
    def detail(self) -> dict[str, str]:
        return {self.field: self.message}


class FixedExpensesWithInstallmentsNotAllowedException(ValidationError):
    default_message = "Despesas fixas não podem ser parceladas"

    def __init__(self) -> None:
        super().__init__(field="installments")


class ExpensesWithInstallmentsMustBeCreditedCardException(ValidationError):
    default_message = "Despesas parceladas devem ser no cartão de crédito"

    def __init__(self) -> None:
        super().__init__(field="installments")


class OnlyUpdateFirstInstallmentDateException(ValidationError):
    default_message = "Você só pode alterar a data da primeira parcela"

    def __init__(self) -> None:
        super().__init__(field="created_at")


class FutureExpenseMustBeCreditCardException(ValidationError):
    default_message = "Uma despesa futura só pode ser realizada usando cartão de crédito"

    def __init__(self) -> None:
        super().__init__(field="created_at__source")


class OnlyUpdateFixedExpenseDateWithinMonthException(ValidationError):
    default_message = "Você só pode alterar a data de uma despesa fixa passada dentro do mesmo mês"

    def __init__(self) -> None:
        super().__init__(field="created_at")


class OnlyUpdateFixedRevenueDateWithinMonthException(ValidationError):
    default_message = "Você só pode alterar a data de uma receita fixa passada dentro do mesmo mês"

    def __init__(self) -> None:
        super().__init__(field="created_at")
