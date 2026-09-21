import pytest
from authentication.serializers import FirePreferencesSerializer

@pytest.mark.parametrize("years", [0, 1, 3, 60])
def test_extra_accumulation_years_round_trip(years):
    serializer = FirePreferencesSerializer(data={"extra_accumulation_years": years})
    assert serializer.is_valid(), serializer.errors
    assert serializer.data["extra_accumulation_years"] == years

@pytest.mark.parametrize("years", [-1, 61, 1.5, None, "invalid"])
def test_extra_accumulation_years_reject_invalid_values(years):
    serializer = FirePreferencesSerializer(data={"extra_accumulation_years": years})
    assert not serializer.is_valid()

def test_old_preferences_remain_valid():
    serializer = FirePreferencesSerializer(data={"withdrawal_rate": 4})
    assert serializer.is_valid(), serializer.errors
    assert "extra_accumulation_years" not in serializer.data
