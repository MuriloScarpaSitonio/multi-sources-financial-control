from django.contrib.auth import get_user_model

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.decorators import action
from rest_framework.mixins import CreateModelMixin, RetrieveModelMixin, UpdateModelMixin
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_204_NO_CONTENT
from rest_framework.viewsets import GenericViewSet
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView

from .auth import UIDB64Authentication
from .serializers import (
    ActivateUserSerializer,
    ChangePasswordSerializer,
    ResetPasswordRequestSerializer,
    ResetPasswordSerializer,
    UserSerializer,
)
from .utils import (
    dispatch_activation_email,
    dispatch_not_found_email,
    dispatch_reset_password_email,
)

UserModel = get_user_model()


@extend_schema_view(
    retrieve=extend_schema(exclude=True),
    create=extend_schema(exclude=True),
    update=extend_schema(exclude=True),
    partial_update=extend_schema(exclude=True),
    change_password=extend_schema(exclude=True),
)
class UserViewSet(GenericViewSet, CreateModelMixin, RetrieveModelMixin, UpdateModelMixin):
    serializer_class = UserSerializer
    queryset = UserModel.objects.select_related("secrets").all()

    def get_permissions(self) -> list:
        return [] if self.action == "create" else super().get_permissions()

    def get_authenticators(self) -> list:
        # self.action throws AttributeError
        return (
            [] if self.request and self.request.method == "POST" else super().get_authenticators()
        )

    def perform_create(self, serializer: UserSerializer) -> None:
        user = serializer.save()
        dispatch_activation_email(user=user)

    @action(methods=("PATCH",), detail=True)
    def change_password(self, request: Request, **kw) -> Response:
        serializer = ChangePasswordSerializer(
            data=request.data, context={"user": self.get_object()}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=HTTP_204_NO_CONTENT)


@extend_schema_view(
    forgot_password=extend_schema(exclude=True),
    reset_password=extend_schema(exclude=True),
    activate_user=extend_schema(exclude=True),
)
class AuthViewSet(GenericViewSet):
    permission_classes = ()
    authentication_classes = ()

    @action(methods=("POST",), detail=False)
    def forgot_password(self, request: Request) -> Response:
        serializer = ResetPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if user := UserModel.objects.filter(email=serializer.validated_data["email"]).first():
            dispatch_reset_password_email(user=user)
        else:
            dispatch_not_found_email(email=serializer.validated_data["email"])
        return Response(status=HTTP_204_NO_CONTENT)

    @action(
        methods=("POST",),
        detail=False,
        url_path=r"reset_password/(?P<uidb64>\w+)",
        authentication_classes=(UIDB64Authentication,),
    )
    def reset_password(self, request: Request, **kw) -> Response:
        serializer = ResetPasswordSerializer(data=request.data, context={"user": request.user})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=HTTP_204_NO_CONTENT)

    @action(
        methods=("POST",),
        detail=False,
        url_path=r"activate_user/(?P<uidb64>\w+)",
        authentication_classes=(UIDB64Authentication,),
    )
    def activate_user(self, request: Request, **kw) -> Response:
        serializer = ActivateUserSerializer(
            data=request.data, context={"user": request.user, "token_expires": False}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=HTTP_204_NO_CONTENT)


class TokenWUserObtainPairView(TokenObtainPairView):
    @extend_schema(exclude=True)
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
