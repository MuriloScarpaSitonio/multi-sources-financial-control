from ..utils import camel_to_snake_keys


def test_camel_to_snake_simple(self):
    # GIVEN
    camel_data = {
        "tickerSymbol": "PETR4",
        "tradeQuantity": 100,
        "priceValue": 25.75,
        "tradeDateTime": "2023-10-15T14:30:00",
    }

    expected = {
        "ticker_symbol": "PETR4",
        "trade_quantity": 100,
        "price_value": 25.75,
        "trade_date_time": "2023-10-15T14:30:00",
    }

    # WHEN
    result = camel_to_snake_keys(camel_data)

    # THEN
    assert result == expected


def test_camel_to_snake_nested(self):
    # GIVEN
    camel_data = {
        "data": {
            "equitiesPeriods": {
                "equitiesMovements": [
                    {
                        "tickerSymbol": "PETR4",
                        "tradeQuantity": 100,
                        "priceValue": 25.75,
                    },
                    {
                        "tickerSymbol": "VALE3",
                        "tradeQuantity": 50,
                        "priceValue": 68.45,
                    },
                ]
            }
        },
        "links": {
            "self": "https://api.b3.com.br/movements?page=1",
            "next": "https://api.b3.com.br/movements?page=2",
            "last": "https://api.b3.com.br/movements?page=10",
        },
    }

    expected = {
        "data": {
            "equities_periods": {
                "equities_movements": [
                    {
                        "ticker_symbol": "PETR4",
                        "trade_quantity": 100,
                        "price_value": 25.75,
                    },
                    {
                        "ticker_symbol": "VALE3",
                        "trade_quantity": 50,
                        "price_value": 68.45,
                    },
                ]
            }
        },
        "links": {
            "self": "https://api.b3.com.br/movements?page=1",
            "next": "https://api.b3.com.br/movements?page=2",
            "last": "https://api.b3.com.br/movements?page=10",
        },
    }

    # WHEN
    result = camel_to_snake_keys(camel_data)

    # THEN
    assert result == expected
