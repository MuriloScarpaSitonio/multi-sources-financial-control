from django.contrib.auth import get_user_model

import pytest

from ..choices import SubscriptionStatus

UserModel = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.mark.usefixtures("user")
def test__filter_personal_finances_active():
    # GIVEN

    # WHEN
    qs = UserModel.objects.filter_personal_finances_active()

    # THEN
    assert qs.count() == 0


def test__filter_personal_finances_active__status(user):
    # GIVEN
    user.subscription_status = SubscriptionStatus.ACTIVE
    user.save()

    # WHEN
    qs = UserModel.objects.filter_personal_finances_active()

    # THEN
    assert qs.count() == 1


def test__filter_personal_finances_active__module(user):
    # GIVEN
    user.subscription_status = SubscriptionStatus.ACTIVE
    user.is_personal_finances_module_enabled = False
    user.save()

    # WHEN
    qs = UserModel.objects.filter_personal_finances_active()

    # THEN
    assert qs.count() == 0


@pytest.mark.usefixtures("user")
def test__filter_investments_integrations_active():
    # GIVEN

    # WHEN
    qs = UserModel.objects.filter_investments_integrations_active()

    # THEN
    assert qs.count() == 1


def test__filter_investments_integrations_active__module(user):
    # GIVEN
    user.is_investments_integrations_module_enabled = False
    user.save()

    # WHEN
    qs = UserModel.objects.filter_investments_integrations_active()

    # THEN
    assert qs.count() == 0


def test__filter_investments_integrations_active__status(user):
    # GIVEN
    user.subscription_status = SubscriptionStatus.TRIALING
    user.save()

    # WHEN
    qs = UserModel.objects.filter_investments_integrations_active()

    # THEN
    assert qs.count() == 1


@pytest.mark.usefixtures("user")
def test__filter_investments_integrations_active__kucoin():
    # GIVEN

    # WHEN
    qs = UserModel.objects.filter_kucoin_integration_active()

    # THEN
    assert qs.count() == 0


@pytest.mark.usefixtures("user_with_kucoin_integration")
def test__filter_investments_integrations_active__kucoin__true():
    # GIVEN

    # WHEN
    qs = UserModel.objects.filter_kucoin_integration_active()

    # THEN
    assert qs.count() == 1


@pytest.mark.usefixtures("user")
def test__filter_investments_integrations_active__binance():
    # GIVEN

    # WHEN
    qs = UserModel.objects.filter_binance_integration_active()

    # THEN
    assert qs.count() == 0


@pytest.mark.usefixtures("user_with_binance_integration")
def test__filter_investments_integrations_active__binance__true():
    # GIVEN

    # WHEN
    qs = UserModel.objects.filter_binance_integration_active()

    # THEN
    assert qs.count() == 1
