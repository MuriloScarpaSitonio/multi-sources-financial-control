import ssl

import stripe

from authentication.services import stripe as stripe_service  # noqa: F401


def test_stripe_uses_system_certificate_store():
    assert stripe.ca_bundle_path == ssl.get_default_verify_paths().openssl_cafile
