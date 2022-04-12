from decouple import config as secret

DATABASE_URL = secret("DATABASE_URL", default="sqlite:///../django/db.sqlite3")
