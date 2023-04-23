from urllib.parse import urljoin

from django.conf import settings

from rest_framework.mixins import CreateModelMixin, RetrieveModelMixin, UpdateModelMixin
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView

import requests

from .models import CustomUser
from .serializers import UserSerializer


class UserViewSet(
    GenericViewSet,
    CreateModelMixin,
    RetrieveModelMixin,
    UpdateModelMixin,
):
    serializer_class = UserSerializer
    queryset = CustomUser.objects.select_related("secrets").all()


class TokenWUserObtainPairView(TokenObtainPairView):
    def post(self, request: Request, *_, **__) -> Response:
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        return Response(
            {"user": UserSerializer(serializer.user).data, **serializer.validated_data},
            status=HTTP_200_OK,
        )


@extend_schema_view(
    get=extend_schema(exclude=True),
    post=extend_schema(exclude=True),
    put=extend_schema(exclude=True),
    patch=extend_schema(exclude=True),
    delete=extend_schema(exclude=True),
)
class APIGatewayView(APIView):  # pragma: no cover
    url: str
    key: str

    def _handle_request(self, request: Request) -> Response:
        headers = {"user-id": str(request.user.id), "x-key": self.key}
        url = urljoin(self.url, request.path_info.split("gateway")[-1])
        response = requests.request(
            method=request.method,
            url=url,
            headers=headers,
            params=request.query_params,
            json=request.data,
        )
        data = (
            response.json()
            if response.headers.get("Content-Type", "").lower() == "application/json"
            else response.content
        )
        return Response(data, status=response.status_code)

    def get(self, request: Request) -> Response:
        return self._handle_request(request=request)

    def post(self, request: Request) -> Response:
        return self._handle_request(request=request)

    def put(self, request: Request) -> Response:
        return self._handle_request(request=request)

    def patch(self, request: Request) -> Response:
        return self._handle_request(request=request)

    def delete(self, request: Request) -> Response:
        return self._handle_request(request=request)


class RevenuesAPIGatewayView(APIGatewayView):
    url = settings.REVENUES_API_URL
    key = settings.REVENUES_API_SECRET_KEY
