from typing import Dict, Optional


class ValidationError(Exception):
    default_message: Optional[str] = None

    def __init__(
        self,
        *,
        field: str,
        message: Optional[str] = None,
        message_interpolation_params: Optional[Dict[str, str]] = None,
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
    def detail(self) -> Dict[str, str]:
        return {self.field: self.message}


class MultipleCurrenciesNotAllowedException(ValidationError):
    default_message = (
        "Only one currency per asset is supported. Current currency: %(asset_currency)s"
    )

    def __init__(self, asset_currency: str) -> None:
        super().__init__(
            field="currency", message_interpolation_params={"asset_currency": asset_currency}
        )


class NegativeQuantityNotAllowedException(ValidationError):
    default_message = "You can't sell more assets than you own"

    def __init__(self) -> None:
        super().__init__(field="action")
