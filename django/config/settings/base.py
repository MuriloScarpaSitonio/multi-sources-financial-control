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
DOMAIN = secret("DOMAIN", default="http://localhost:8000")

ENV_PRODUCTION = "PRODUCTION"
ENV_LOCAL = "LOCAL"
ENVIRONMENT = secret("DJANGO_DEBUG", default=ENV_LOCAL)

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

ASSETS_INTEGRATIONS_URL = secret("ASSETS_INTEGRATIONS_URL", default="http://localhost:5000/")
REVENUES_API_URL = secret("REVENUES_API_URL", default="http://localhost:5050/")
REVENUES_API_SECRET_KEY = secret(
    "REVENUES_API_SECRET_KEY", default="^ko+7^$@c4=!mzn58hdgs8xydak4@by7g&@@%&4a_kgb42g&__"
)
TWELVE_DATA_API_KEY = secret("TWELVE_DATA_API_KEY", default="")

DYNAMIC_BACKEND = "config.settings.dynamic.backends.memory.MemoryBackend"
DYNAMIC_CONFIGS = {
    "DOLLAR_CONVERSION_RATE": {
        "default": Decimal("5.0"),
        "fetch_func": "config.settings.dynamic.utils.fetch_dollar_conversion_ratio",
    }
}
CRYPTOS_TO_SKIP_INTEGRATION = ("USDT",)
USD_CRYPTO_SYMBOLS = ("USDT",)

GDRIVE_BACKUP_DB_FOLDER_ID = secret("GDRIVE_BACKUP_DB_FOLDER_ID", default="")

# se a soma das vendas (e não do lucro) das ações em carteira ficarem
# abaixo de R$ 20 mil no mês, o investidor fica isento.
STOCKS_MONTHLY_SELL_EXEMPTION_THRESHOLD = 20_000

# as vendas até R$ 35.000, mesmo que tenham lucro, ficam isentas do imposto de renda.
# Isso acontece porque os investimentos no exterior seguem a regra da tributação de Ganho de Capital.
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
