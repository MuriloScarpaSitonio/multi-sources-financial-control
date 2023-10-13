from django.contrib.auth import get_user_model

from .tasks import (
    create_fixed_expenses_from_last_month,
    create_fixed_revenues_from_last_month,
)

UserModel = get_user_model()


def create_all_fixed_entities_from_last_month():
    for user_id in UserModel.objects.filter_personal_finances_active().values_list("pk", flat=True):
        create_fixed_expenses_from_last_month(user_id=user_id)
        create_fixed_revenues_from_last_month(user_id=user_id)
