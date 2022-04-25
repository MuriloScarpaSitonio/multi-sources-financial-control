from decouple import config as secret

DATABASE_URL = secret("DATABASE_URL", default="sqlite:///../django/db.sqlite3")

ACCOUNTANT_EMAIL = "accountant@email.com"
AGILIZE_URL = "api.agilize.com"
