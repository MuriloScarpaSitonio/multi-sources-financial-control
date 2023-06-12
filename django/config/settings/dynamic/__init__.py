from typing import Any

from django.conf import settings
from django.utils.functional import LazyObject

from .utils import import_module_attr


class DynamicSettings:
    def __init__(self) -> None:
        super().__setattr__("_backend", import_module_attr(settings.DYNAMIC_BACKEND)())

    def __getattr__(self, key: str) -> Any:
        try:
            config = settings.DYNAMIC_CONFIGS[key]
        except KeyError:
            raise AttributeError(key)

        result = self._backend.get(key)
        if result is None:
            result = config["default"]
            if config.get("fetch_func") is not None:
                try:
                    result = import_module_attr(config["fetch_func"])()
                except Exception:
                    pass
            setattr(self, key, result)
            return result
        return result

    def __setattr__(self, key: str, value: Any) -> None:
        if key not in settings.DYNAMIC_CONFIGS:
            raise AttributeError(key)
        self._backend.set(key, value)

    def __dir__(self) -> list[str]:
        return settings.DYNAMIC_CONFIGS.keys()


class LazyDynamicSettings(LazyObject):
    def _setup(self):
        self._wrapped = DynamicSettings()


dynamic_settings = LazyDynamicSettings()
