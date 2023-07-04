from ..choices import Currencies, TransactionActions


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


class NegativeQuantityNotAllowedException(ValidationError):
    default_message = "You can't sell more assets than you own"

    def __init__(self) -> None:
        super().__init__(field="action")


class CurrencyConversionRateNotNullWhenActionIsBuy(ValidationError):
    default_message = (
        f"This value must be ommited when the action of a transaction is {TransactionActions.buy}"
    )

    def __init__(self) -> None:
        super().__init__(field="current_currency_conversion_rate")


class CurrencyConversionRateNullOrOneForNonBrlAssets(ValidationError):
    default_message = (
        "This value can't be ommited or set to 1 if the asset's currency is "
        f"different than {Currencies.real}"
    )

    def __init__(self) -> None:
        super().__init__(field="current_currency_conversion_rate")
