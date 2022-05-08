from .models import Revenue
from .utils import generate_pydantic_model


class Command:
    pass


RevenuePydanticModel = generate_pydantic_model(Revenue)


class CreateRevenue(RevenuePydanticModel, Command):
    pass
