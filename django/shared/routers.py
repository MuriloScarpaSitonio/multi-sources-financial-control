from typing import Type, TYPE_CHECKING

from rest_framework.routers import DefaultRouter, Route

if TYPE_CHECKING:
    from rest_framework.viewsets import ViewSet


class NestedMixin:
    """
    This mixin is a slightly modified version of the implementation found within the
    `drf-nested-routers` https://github.com/alanjds/drf-nested-routers/blob/master/rest_framework_nested/routers.py
    """

    def __init__(
        self,
        parent_router: DefaultRouter,
        parent_prefix: str,
        lookup: str | None = None,
        *args,
        **kwargs,
    ):
        self.parent_router = parent_router
        self.parent_prefix = parent_prefix
        self.lookup = lookup

        super().__init__(*args, **kwargs)

        for registered in self.parent_router.registry:
            if registered[0] == self.parent_prefix:
                parent_prefix, parent_viewset, _ = registered

        self.parent_regex = f"{parent_prefix}/{self._get_lookup_regex(parent_viewset)}/"

        nested_routes: list["Route"] = []
        for route in self.routes:
            route_contents = route._asdict()

            # This will get passed through .format in a little bit, so we need
            # to escape it
            escaped_parent_regex = self.parent_regex.replace("{", "{{").replace("}", "}}")

            route_contents["url"] = route.url.replace("^", "^" + escaped_parent_regex)
            nested_routes.append(route.__class__(**route_contents))

        self.routes = nested_routes

    def _get_lookup_regex(self, parent_viewset: Type["ViewSet"]) -> str:
        """Slightly modified version of SimpleRouter.get_lookup_regex"""
        base_regex = "(?P<{lookup_prefix}>{lookup_value})"
        return base_regex.format(
            lookup_prefix=self.lookup or parent_viewset.lookup_field,
            lookup_value=getattr(parent_viewset, "lookup_value_regex", "[^/.]+"),
        )


class NestedDefaultRouter(NestedMixin, DefaultRouter):
    pass
