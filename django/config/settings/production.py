from .base import *

DEBUG = secret("DJANGO_DEBUG", cast=bool, default=False)

ENVIRONMENT = ENV_PRODUCTION
EMAIL_BACKEND = "anymail.backends.sendinblue.EmailBackend"

DATABASES["default"] = {
    "ENGINE": "django.db.backends.postgresql",
    "NAME": secret("DB_NAME"),
    "USER": secret("DB_USER"),
    "PASSWORD": secret("DB_PASSWORD"),
    "HOST": secret("DB_HOST"),
    "PORT": secret("DB_PORT", default=5432, cast=int),
    "OPTIONS": {"pool": True},
}

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = secret("CORS_ALLOWED_ORIGINS", default="", cast=Csv())

# For sites that should only be accessed over HTTPS, you can instruct modern browsers
# to refuse to connect to your domain name via an insecure connection (for a given period of time)
#  by setting the “Strict-Transport-Security” header. This reduces your exposure to some
# SSL-stripping man-in-the-middle (MITM) attacks.
# SecurityMiddleware will set this header for you on all HTTPS responses if you set the
# SECURE_HSTS_SECONDS setting to a non-zero integer value. When enabling HSTS, it’s a good idea to
# first use a small value for testing, for example, SECURE_HSTS_SECONDS = 3600 for one hour.
# Each time a Web browser sees the HSTS header from your site, it will refuse to communicate
# non-securely (using HTTP) with your domain for the given period of time. Once you confirm that
# all assets are served securely on your site (i.e. HSTS didn’t break anything), it’s a good idea
# to increase this value so that infrequent visitors will be protected
# (31536000 seconds, i.e. 1 year, is common).
# https://docs.djangoproject.com/en/3.1/ref/middleware/#http-strict-transport-security
SECURE_HSTS_SECONDS = secret("SECURE_HSTS_SECONDS", cast=int, default=1)

# If True, the SecurityMiddleware redirects all non-HTTPS requests to HTTPS
# (except for those URLs matching a regular expression listed in SECURE_REDIRECT_EXEMPT).
# https://docs.djangoproject.com/en/3.1/ref/settings/#secure-ssl-redirect
# setting to false because nginx will be responsbile for that
SECURE_SSL_REDIRECT = False


SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


# Whether to use a secure cookie for the session cookie. If this is set to True, the cookie
# will be marked as “secure”, which means browsers may ensure that the cookie is only
# sent under an HTTPS connection. Leaving this setting off isn’t a good idea because an attacker
# could capture an unencrypted session cookie with a packet sniffer and use the cookie to hijack
# the user’s session.
# https://docs.djangoproject.com/en/3.1/ref/settings/#session-cookie-secure
SESSION_COOKIE_SECURE = True

# If True, the SecurityMiddleware adds the includeSubDomains directive to the HTTP Strict Transport
# Security header. It has no effect unless SECURE_HSTS_SECONDS is set to a non-zero value.
# Without this, your site is potentially vulnerable to attack via an insecure connection to a
# subdomain. Only set this to True if you are certain that all subdomains of your domain should be
# served exclusively via SSL.
# https://docs.djangoproject.com/en/3.1/ref/settings/#secure-hsts-include-subdomains
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# If True, the SecurityMiddleware adds the preload directive to the HTTP Strict Transport
# Security header. It has no effect unless SECURE_HSTS_SECONDS is set to a non-zero value.
# Without this, your site cannot be submitted to the browser preload list.
# https://docs.djangoproject.com/en/3.1/ref/settings/#secure-hsts-preload
SECURE_HSTS_PRELOAD = True

# Whether to use a secure cookie for the CSRF cookie. If this is set to True,
# the cookie will be marked as “secure”, which means browsers may ensure that the cookie is
# only sent with an HTTPS connection. Using a secure-only CSRF cookie makes it more difficult
# for network traffic sniffers to steal the CSRF token.
# https://docs.djangoproject.com/en/3.1/howto/deployment/checklist/#csrf-cookie-secure
CSRF_COOKIE_SECURE = True
