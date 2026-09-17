import pytest

from .. import serializers as serializer_module
from ..serializers import PlanningPreferencesSerializer


@pytest.mark.parametrize(
    "serializer_name",
    (
        "FirePreferencesSerializer",
        "DividendsOnlyPreferencesSerializer",
        "OneOverNPreferencesSerializer",
        "VPWPreferencesSerializer",
    ),
)
def test__planning_preference_serializers_live_at_module_scope(serializer_name):
    assert hasattr(serializer_module, serializer_name)
    assert not hasattr(PlanningPreferencesSerializer, serializer_name)
