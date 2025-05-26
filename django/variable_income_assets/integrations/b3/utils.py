import re
from typing import Any


def camel_to_snake(name: str) -> str:
    """Convert camelCase to snake_case."""
    # Add underscore before each uppercase letter and convert to lowercase
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


JSONValue = dict[str, Any] | list[Any] | str | int | float | bool | None


def camel_to_snake_keys(data: JSONValue) -> JSONValue:
    """
    Recursively convert all dictionary keys from camelCase to snake_case in a JSON structure.

    Args:
        data: Any JSON-compatible value (dict, list, string, number, boolean, or None)

    Returns:
        The same structure with all dictionary keys converted to snake_case
    """
    if isinstance(data, dict):
        return {camel_to_snake(key): camel_to_snake_keys(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [camel_to_snake_keys(item) for item in data]
    else:
        # For primitive values (str, int, float, bool, None)
        return data
