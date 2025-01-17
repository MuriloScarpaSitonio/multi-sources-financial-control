from ..choices import Currencies


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
    default_message = "Você não pode vender mais ativos que possui"

    def __init__(self) -> None:
        super().__init__(field="action")


class CurrencyConversionRateNullOrOneForNonBrlAssets(ValidationError):
    default_message = (
        "This value can't be ommited or set to 1 if the asset's currency is "
        f"different than {Currencies.real}"
    )

    def __init__(self) -> None:
        super().__init__(field="current_currency_conversion_rate")


class FutureTransactionNotAllowedException(ValidationError):
    default_message = "You can't create a transaction in the future"

    def __init__(self) -> None:
        super().__init__(field="operation_date")


class SpaceNotAllowedInB3AssetCode(ValidationError):
    default_message = "O código de um ativo só pode ter espaços se não for custodiado pela b3"

    def __init__(self) -> None:
        super().__init__(field="code")


class InvalidAssetCurrentException(ValidationError):
    default_message = "%(currency)s não é válido(a) para ativos de classe %(type)s"

    def __init__(self, *, message_interpolation_params: dict[str, str]):
        super().__init__(
            field="currency", message_interpolation_params=message_interpolation_params
        )


class AssetCodeTypeCurrencyAlreadyExistsException(ValidationError):
    default_message = "Você não pode ter dois ativos com o mesmo código, moeda e categoria"

    def __init__(self):
        super().__init__(field="asset")


class AssetHeldInSelfCustodyButNotFixedException(ValidationError):
    default_message = "Apenas ativos de renda fixa podem ser custodiados fora da b3"

    def __init__(self):
        super().__init__(field="type")


class AssetNotHeldInSelfCustodyWithoutQuantityException(ValidationError):
    default_message = (
        "Apenas ativos de renda fixa custodiados fora da b3 podem "
        "ter transações com quantidades nulas"
    )

    def __init__(self):
        super().__init__(field="quantity")
