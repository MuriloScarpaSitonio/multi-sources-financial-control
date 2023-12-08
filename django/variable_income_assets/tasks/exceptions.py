class AssetOpenedException(Exception):
    def __init__(self, asset_pk: int) -> None:
        super().__init__(
            f"Esse ativo (pk={asset_pk}) ainda tem um saldo positivo de transações. "
            "Essa operação deve ser realizada apenas em ativos com um balanço de transações zerado"
        )
