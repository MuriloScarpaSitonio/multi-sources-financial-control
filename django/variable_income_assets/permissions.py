from rest_framework.permissions import BasePermission


class _IntegrationPermission(BasePermission):
    property_name: str

    def has_permission(self, request, _):
        return getattr(request.user, self.property_name, False)


class BinancePermission(_IntegrationPermission):
    message = "User has not set the given credentials for Binance integration"
    property_name = "has_binance_integration"


class AssetsPricesPermission(_IntegrationPermission):
    message = "User has not set the given credentials for Assets Prices integration"
    property_name = "has_asset_price_integration"


class CeiPermission(_IntegrationPermission):
    message = "User has not set the given credentials for CEI integration"
    property_name = "has_cei_integration"


class KuCoinPermission(_IntegrationPermission):
    message = "User has not set the given credentials for KuCoin integration"
    property_name = "has_kucoin_integration"
