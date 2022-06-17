from decouple import config as secret

SECRET_KEY = secret("SECRET_KEY", default="^ko+7^$@c4=!mzn58hdgs8xydak4@by7g&@@%&4a_kgb42g&__")

DATABASE_URL = secret("DATABASE_URL", default="mongodb://localhost:27017")
DATABASE_NAME = secret("DATABASE_NAME", default="Revenues")
COLLECTION_NAME = secret("COLLECTION_NAME", default="revenues")

ACCOUNTANT_EMAIL = secret("ACCOUNTANT_EMAIL", default="accountant@email.com")
AGILIZE_URL = secret("AGILIZE_URL", default="api.agilize.com")
