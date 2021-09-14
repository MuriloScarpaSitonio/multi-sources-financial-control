from datetime import date

from django.utils import timezone


def serializable_today_function() -> date:
    """
    timezone.now().date directly on the default value of a DateField will raise the following error:
    ValueError: Cannot serialize function <built-in method date of datetime.datetime
    """
    return timezone.now().date()
