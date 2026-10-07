from django.conf import settings


def test_postgresql_is_unconditional():
    assert settings.DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql"
    assert not hasattr(settings, "USE_POSTGRES")


def test_native_lexeme_available():
    from django.contrib.postgres.search import Lexeme

    assert Lexeme("super", prefix=True) is not None
