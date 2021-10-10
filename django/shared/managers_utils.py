from django.db.models import QuerySet, Sum


class SumMixin:
    @staticmethod
    def _get_sum_expression(*args, **kwargs) -> Sum:
        raise NotImplementedError()  # pragma: no cover

    def sum(self, *args, **kwargs) -> QuerySet:
        return self.aggregate(**self._get_sum_expression(*args, **kwargs))


class CustomQueryset(QuerySet, SumMixin):
    def annotate_sum(self, *args, **kwargs) -> QuerySet:
        return self.annotate(**self._get_sum_expression(*args, **kwargs)).order_by()

    def aggregate_field(self, field_name: str, *args, **kwargs) -> QuerySet:
        return self.values(field_name).annotate_sum(*args, **kwargs)
