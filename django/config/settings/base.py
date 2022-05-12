from decimal import Decimal
from pathlib import Path

from decouple import Csv, config as secret

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/3.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = secret(
    "SECRET_KEY",
    default="django-insecure-km+p$=j_@$y6hj%^u=s5ak#8%bwz^+z8%q34!+qhw+gerv@y-j",
)
# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = secret("DJANGO_DEBUG", cast=bool, default=True)

ALLOWED_HOSTS = secret("ALLOWED_HOSTS", default="*", cast=Csv())


# Application definition

DEFAULT_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

LOCAL_APPS = [
    "authentication.apps.AuthenticationConfig",
    "variable_income_assets.apps.VariableIncomeAssetsConfig",
    "expenses.apps.ExpensesConfig",
    "tasks.apps.TasksConfig",
    "revenues.apps.RevenuesConfig",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
]

INSTALLED_APPS = DEFAULT_APPS + LOCAL_APPS + THIRD_PARTY_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# https://docs.djangoproject.com/en/3.2/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}


# Password validation
# https://docs.djangoproject.com/en/3.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 4},
    },
]


# Internationalization
# https://docs.djangoproject.com/en/3.2/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/3.2/howto/static-files/

STATIC_URL = "/static/"

# Default primary key field type
# https://docs.djangoproject.com/en/3.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

BASE_API_URL = "api/v1/"

AUTH_USER_MODEL = "authentication.CustomUser"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "shared.pagination.CustomPageNumberPagination",
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DATE_INPUT_FORMATS": ["%d/%m/%Y"],
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
    "PAGE_SIZE": 5,
    "COERCE_DECIMAL_TO_STRING": False,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Multi Sources Financial Control API",
    "DESCRIPTION": "B3, USA stocks and cryptos crawler + expenses tracker",
    "VERSION": "1.0.0",
}

CORS_ALLOW_ALL_ORIGINS = True

FERNET_KEY = secret(
    "FERNET_KEY",
    cast=lambda v: v.encode(),
    default="TFGiLL_iX38XrRzwH9Ya4qEUY2gbAuanHbC3R7ZYwoo=",
)

CRAWLERS_URL = secret("CRAWLERS_URL", default="http://localhost:5000/")

CELERY_BROKER_URL = secret("CELERY_BROKER_URL", default="amqp://guest:guest@rabbitmq:5672")
CELERY_IGNORE_RESULT = True
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 600  # 10min
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_CREATE_MISSING_QUEUES = True
CELERY_TASK_ALWAYS_EAGER = True
CELERY_ACCEPT_CONTENT = ["application/json"]
CELERY_RESULT_SERIALIZER = "json"
CELERY_TASK_SERIALIZER = "json"

DOLLAR_CONVERSION_RATE = Decimal("4.80")
CRYPTOS_TO_SKIP_INTEGRATION = ("USDT",)
