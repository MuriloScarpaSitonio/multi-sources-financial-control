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
