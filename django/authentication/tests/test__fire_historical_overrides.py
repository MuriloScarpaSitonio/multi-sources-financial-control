import pytest

from authentication.serializers import FirePreferencesSerializer


def test__historical_dataset_override_round_trips():
    value = {"historical_series_overrides": {"FIXED_SELIC:IMA_S": "CDI"}}
    serializer = FirePreferencesSerializer(data=value)
    assert serializer.is_valid(), serializer.errors
    assert serializer.data == value


@pytest.mark.parametrize(
    "overrides",
    [
        {"FIXED_SELIC:IMA_S": "UNKNOWN"},
        {"not-a-bucket": "CDI"},
        {"CASH:CASH": "CDI"},
    ],
)
def test__invalid_historical_dataset_override_is_rejected(overrides):
    serializer = FirePreferencesSerializer(data={"historical_series_overrides": overrides})
    assert not serializer.is_valid()


def test__historical_fallback_round_trips_and_can_be_removed():
    for fallbacks in ({"FIXED_IPCA:IMA_B_5_PLUS": "IBOV"}, {}):
        value = {"historical_series_fallbacks": fallbacks}
        serializer = FirePreferencesSerializer(data=value)
        assert serializer.is_valid(), serializer.errors
        assert serializer.data == value


@pytest.mark.parametrize("fallbacks", [{"not-a-bucket": "IBOV"}, {"FIXED_SELIC:IMA_S": "UNKNOWN"}])
def test__invalid_historical_fallback_is_rejected(fallbacks):
    serializer = FirePreferencesSerializer(data={"historical_series_fallbacks": fallbacks})
    assert not serializer.is_valid()
