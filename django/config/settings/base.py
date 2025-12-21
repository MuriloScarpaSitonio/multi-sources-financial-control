from decimal import Decimal
from pathlib import Path

from decouple import Csv
from decouple import config as secret

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/3.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = secret(
    "DJANGO_SECRET_KEY",
    default="django-insecure-km+p$=j_@$y6hj%^u=s5ak#8%bwz^+z8%q34!+qhw+gerv@y-j",
)
# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = secret("DJANGO_DEBUG", cast=bool, default=True)

ALLOWED_HOSTS = secret("ALLOWED_HOSTS", default="*", cast=Csv())
DOMAIN = secret("DOMAIN", default="http://localhost:8000")

ENV_PRODUCTION = "PRODUCTION"
ENV_LOCAL = "LOCAL"
ENVIRONMENT = secret("ENVIRONMENT", default=ENV_LOCAL)

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
]

THIRD_PARTY_APPS = ["rest_framework", "django_filters", "drf_spectacular", "corsheaders", "anymail"]

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
USE_POSTGRES = secret("USE_POSTGRES", cast=bool, default=False)
USE_REDIS = secret("USE_REDIS", cast=bool, default=False)


# Database
# https://docs.djangoproject.com/en/3.2/ref/settings/#databases

if USE_POSTGRES:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": secret("POSTGRES_DB", default="test_db"),
            "USER": secret("POSTGRES_USER", default="postgres"),
            "PASSWORD": secret("POSTGRES_PASSWORD", default="postgres"),
            "HOST": secret("POSTGRES_HOST", default="localhost"),
            "PORT": secret("POSTGRES_PORT", default=5433, cast=int),
        }
    }
else:
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
PASSWORD_RESET_TIMEOUT = 6 * 60 * 60  # 6h

# Internationalization
# https://docs.djangoproject.com/en/3.2/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "America/Sao_Paulo"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/3.2/howto/static-files/

STATIC_URL = "/static/"

# Default primary key field type
# https://docs.djangoproject.com/en/3.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

BASE_API_URL = "api/v1/"

AUTH_USER_MODEL = "authentication.CustomUser"

EMAIL_BACKEND = "anymail.backends.brevo.EmailBackend"
ANYMAIL = {"SENDINBLUE_API_KEY": secret("BREVO_API_KEY", default="")}
BREVO_TEMPLATE_IDS = {
    "activation": secret("BREVO_ACTIVATION_TEMPLATE_ID", default=0, cast=int),
    "not_found": secret("BREVO_NOT_FOUND_TEMPLATE_ID", default=0, cast=int),
    "reset_password": secret("BREVO_RESET_PASSWORD_TEMPLATE_ID", default=0, cast=int),
}

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
    "DESCRIPTION": "B3, USA stocks and cryptos crawler + expenses and revenues tracker",
    "VERSION": "0.0.1",
    "ENUM_NAME_OVERRIDES": {"AssetTypeEnum": "variable_income_assets.choices.AssetTypes.choices"},
}

CORS_ALLOW_ALL_ORIGINS = True

FERNET_KEY = secret(
    "FERNET_KEY",
    cast=lambda v: v.encode(),
    default="TFGiLL_iX38XrRzwH9Ya4qEUY2gbAuanHbC3R7ZYwoo=",
)

TWELVE_DATA_API_KEY = secret("TWELVE_DATA_API_KEY", default="")

BRAPI_API_KEY = secret("BRAPI_API_KEY", default="")

COIN_MARKET_CAP_API_KEY = secret("COIN_MARKET_CAP_API_KEY", default="")

USD_CRYPTO_SYMBOLS = ("USDT", "USDC", "BUSD", "TUSD")

GDRIVE_BACKUP_DB_FOLDER_ID = secret("GDRIVE_BACKUP_DB_FOLDER_ID", default="")

# se a soma das vendas (e não do lucro) das ações em carteira ficarem
# abaixo de R$ 20 mil no mês, o investidor fica isento.
STOCKS_MONTHLY_SELL_EXEMPTION_THRESHOLD = 20_000

# as vendas até R$ 35.000, mesmo que tenham lucro, ficam isentas do imposto de renda.
# Isso acontece porque os investimentos no exterior seguem a regra da tributação de
# Ganho de Capital.
STOCKS_USA_MONTHLY_SELL_EXEMPTION_THRESHOLD = 35_000

# Os ganhos de capital obtidos com negociação de criptoativos ou moedas virtuais são tributados
# sempre que as vendas totais superam R$ 35 mil por mês
CRYPTOS_MONTHLY_SELL_EXEMPTION_THRESHOLD = 35_000

# A tributação de FIIs é de 20% e é feita apenas sobre o lucro.
# Portanto, não existe a isenção para operações normais.
# Todas as operações realizadas com ganho de capital são tributadas nos FIIs.
FII_MONTHLY_SELL_EXEMPTION_THRESHOLD = 0

QSTASH_TOKEN = secret("QSTASH_TOKEN", default="")
QSTASH_CURRENT_SIGNING_KEY = secret("QSTASH_CURRENT_SIGNING_KEY", default="")
QSTASH_NEXT_SIGNING_KEY = secret("QSTASH_NEXT_SIGNING_KEY", default="")

REDIS_CONNECTION_URL = secret("REDIS_CONNECTION_URL", default="redis://localhost:6379")
REDIS_TIMEOUT_IN_SECONDS = secret("REDIS_TIMEOUT_IN_SECONDS", default=1 * 60 * 60, cast=int)

FRONTEND_BASE_URL = secret("FRONTEND_URL", default="http://localhost:3000")

STRIPE_SECRET_KEY = secret("STRIPE_SECRET_KEY", default="")
STRIPE_PUBLIC_KEY = secret("STRIPE_PUBLIC_KEY", default="")
STRIPE_WEBHOOK_SECRET = secret("STRIPE_WEBHOOK_SECRET", default="")
STRIPE_TRIAL_SUBSCRIPTION_PRICE_ID = secret("STRIPE_TRIAL_SUBSCRIPTION_PRICE_ID", default="")

DEFAULT_TRIAL_PERIOD_IN_DAYS = secret("DEFAULT_TRIAL_PERIOD_IN_DAYS", default=7, cast=int)

DOLLAR_CONVERSION_RATE_KEY = secret("DOLLAR_CONVERSION_RATE_KEY", default="DOLLAR_CONVERSION_RATE")
