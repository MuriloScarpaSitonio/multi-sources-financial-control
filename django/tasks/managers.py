from django.db.models import F, QuerySet


class TaskHistoryQuerySet(QuerySet):
    def to_notify(self):
        return self.filter(notified_at__lt=F("updated_at"))
