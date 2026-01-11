import django_filters

from expenses.models import BankAccountSnapshot


class PatrimonyGrowthFilterSet(django_filters.FilterSet):
    months = django_filters.NumberFilter(required=False, min_value=1)
    years = django_filters.NumberFilter(required=False, min_value=1)

    class Meta:
        model = BankAccountSnapshot
        fields = []

    def is_valid(self) -> bool:
        is_valid = super().is_valid()
        if is_valid:
            months = self.form.cleaned_data.get("months")
            years = self.form.cleaned_data.get("years")
            if not months and not years:
                self.form.add_error(None, "É necessário informar ao menos 'months' ou 'years'.")
                return False
        return is_valid
