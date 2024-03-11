from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.auth import get_user_model
from django.db.models import QuerySet
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

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
    StripeCheckoutSessionSerializer,
    UserSerializer,
)
from .services import mailing, stripe, subscription

if TYPE_CHECKING:
    from django.core.handlers.asgi import ASGIRequest
    from django.core.handlers.wsgi import WSGIRequest

UserModel = get_user_model()


class UserViewSet(GenericViewSet, CreateModelMixin, RetrieveModelMixin, UpdateModelMixin):
    serializer_class = UserSerializer

    def get_queryset(self) -> QuerySet[UserModel]:
        if self.request.user.is_authenticated:
            return UserModel.objects.select_related("secrets").filter(pk=self.request.user.pk)
        return UserModel.objects.none()  # pragma: no cover -- drf-spectacular

    def get_permissions(self) -> list:
        return [] if self.action == "create" else super().get_permissions()

    def get_authenticators(self) -> list:
        # self.action throws AttributeError
        return [] if self.request.method == "POST" else super().get_authenticators()

    def perform_create(self, serializer: UserSerializer) -> None:
        user = serializer.save()
        mailing.dispatch_activation_email(user=user)

    @action(methods=("PATCH",), detail=True)
    def change_password(self, request: Request, **kw) -> Response:
        serializer = ChangePasswordSerializer(
            data=request.data, context={"user": self.get_object()}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=HTTP_204_NO_CONTENT)


class AuthViewSet(GenericViewSet):
    permission_classes = ()
    authentication_classes = ()

    @action(methods=("POST",), detail=False)
    def forgot_password(self, request: Request) -> Response:
        serializer = ResetPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if user := UserModel.objects.filter(email=serializer.validated_data["email"]).first():
            mailing.dispatch_reset_password_email(user=user)
        else:
            mailing.dispatch_not_found_email(email=serializer.validated_data["email"])
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
        subscription.activate_user(user=request.user)
        return Response(status=HTTP_204_NO_CONTENT)


class SubscriptionViewSet(GenericViewSet):
    @action(methods=("POST",), detail=False)
    def portal_session(self, request: Request) -> Response:
        session = stripe.create_portal_session(customer_id=request.user.stripe_customer_id)
        return Response({"url": session.url}, status=HTTP_200_OK)

    @action(methods=("POST",), detail=False)
    def checkout_session(self, request: Request) -> Response:
        serializer = StripeCheckoutSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = stripe.create_checkout_session(
            customer_id=request.user.stripe_customer_id,
            price_id=serializer.validated_data["price_id"],
        )
        return Response({"url": session.url}, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def products(self, _: Request) -> Response:
        return Response(
            {
                "products": {
                    p.metadata.app_name: {
                        "price_id": p.default_price.id,
                        "description": p.name,
                        "amount": p.default_price.unit_amount / 100,
                    }
                    for p in stripe.list_active_products()
                }
            },
            status=HTTP_200_OK,
        )


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


@csrf_exempt
@require_POST
def stripe_webhook(request: WSGIRequest | ASGIRequest) -> HttpResponse:
    try:
        event = stripe.construct_event(request)
    except Exception:
        return HttpResponse(status=400)

    stripe.process_event(event)

    return HttpResponse(status=200)
