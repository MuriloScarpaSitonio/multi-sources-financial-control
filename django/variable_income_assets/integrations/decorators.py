from collections.abc import Callable
from urllib.parse import urljoin

from django.conf import settings
from django.urls import reverse


def qstash_user_task(func: Callable) -> Callable:
    func.get_invocation_url = lambda: urljoin(
        settings.DOMAIN,
        # this pattern must be followed in urls.py
        reverse(f"qstash_{func.__name__}_endpoint"),
    )
    func.name = f"{func.__name__}_task"

    return func
