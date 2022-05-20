from decouple import config as secret

DATABASE_URL = secret("DATABASE_URL", default="sqlite:///../django/db.sqlite3")
FERNET_KEY = secret(
    "FERNET_KEY",
    cast=lambda v: v.encode(),
    default="TFGiLL_iX38XrRzwH9Ya4qEUY2gbAuanHbC3R7ZYwoo=",
)
TWELVE_DATA_API_KEY = secret("TWELVE_DATA_API_KEY", default="")
