# Import fixtures from other apps for patrimony tests
# Note: Do NOT import autouse fixtures (default_sources, default_categories, etc.)
# as they would be applied to all tests in this directory, including pure unit tests
# Must import `secrets` because `user` depends on it
from authentication.tests.conftest import client, secrets, user  # noqa: F401
from expenses.tests.conftest import bank_account, bank_account_snapshot_factory  # noqa: F401
