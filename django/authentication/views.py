from urllib.parse import urljoin

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.views import PasswordResetConfirmView
from django.http import HttpResponseRedirect

import requests
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.decorators import action
from rest_framework.mixins import CreateModelMixin, RetrieveModelMixin, UpdateModelMixin
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_204_NO_CONTENT
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView

from .auth import ResetPasswordAuthentication
from .permissions import ResetPasswordPermission
from .serializers import (
    ChangePasswordSerializer,
    ResetPasswordRequestSerializer,
    ResetPasswordSerializer,
    UserSerializer,
)
from .utils import dispatch_not_found_email, dispatch_reset_password_email

UserModel = get_user_model()


class UserViewSet(
    GenericViewSet,
    CreateModelMixin,
    RetrieveModelMixin,
    UpdateModelMixin,
):
    serializer_class = UserSerializer
    queryset = UserModel.objects.select_related("secrets").all()

    @action(methods=("PATCH",), detail=True)
    def change_password(self, request: Request, **kw) -> Response:
        user = self.get_object()
        serializer = ChangePasswordSerializer(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=("password",))
        return Response(status=HTTP_204_NO_CONTENT)


class AuthViewSet(GenericViewSet):
    permission_classes = ()
    authentication_classes = ()

    @action(methods=("POST",), detail=False)
    def dispatch_reset_password_email(self, request: Request) -> Response:
        serializer = ResetPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = UserModel.objects.filter(email=serializer.validated_data["email"]).first()
        if user is None:
            dispatch_not_found_email(email=serializer.validated_data["email"])
        else:
            dispatch_reset_password_email(user=user)
        return Response(status=HTTP_204_NO_CONTENT)

    @action(
        methods=("GET", "POST"),
        detail=False,
        url_path=r"reset_password/(?P<uidb64>\w+)/(?P<token>[-\w]+)",
        authentication_classes=(ResetPasswordAuthentication,),
        permission_classes=(ResetPasswordPermission,),
    )
    def reset_password(
        self, request: Request, uidb64: str, token: str
    ) -> Response | HttpResponseRedirect:
        if request.method == "GET" and token != PasswordResetConfirmView.reset_url_token:
            return HttpResponseRedirect(
                redirect_to=request.path.replace(token, PasswordResetConfirmView.reset_url_token)
            )

        serializer = ResetPasswordSerializer(data=request.data, context={"user": request.user})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=("password",))
        return Response(status=HTTP_204_NO_CONTENT)


class TokenWUserObtainPairView(TokenObtainPairView):
    def post(self, request: Request, *_, **__) -> Response:
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0]) from e

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
