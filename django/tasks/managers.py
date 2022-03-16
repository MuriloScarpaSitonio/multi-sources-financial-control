from django.db.models import F, Q, QuerySet


class TaskHistoryQuerySet(QuerySet):
    def was_updated_after_notified(self):
        return self.filter(Q(notified_at__lt=F("updated_at")) | Q(notified_at__isnull=True))
