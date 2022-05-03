from decouple import config as secret

DATABASE_URL = secret("DATABASE_URL", default="mongodb://localhost:27017")
DATABASE_NAME = secret("DATABASE_NAME", default="Revenues")
COLLECTION_NAME = secret("COLLECTION_NAME", default="revenues")

ACCOUNTANT_EMAIL = secret("ACCOUNTANT_EMAIL", default="accountant@email.com")
AGILIZE_URL = secret("AGILIZE_URL", default="api.agilize.com")
