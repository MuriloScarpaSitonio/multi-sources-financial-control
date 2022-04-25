from typing import Any, Dict, Optional, Tuple, Type
from pydantic import BaseModel, create_model


def generate_pydantic_model(
    clas: Type[Any],
    __base__: Optional[Type[BaseModel]] = None,
    default_field_definitions: Optional[Dict[str, Tuple[type, Any]]] = None,
    model_name_suffix: str = "PydanticModel",
) -> Type[BaseModel]:
    field_definitions = default_field_definitions if default_field_definitions is not None else {}
    for name, annotation in clas.__init__.__annotations__.items():
        field_definitions[name] = (annotation, clas.__init__.__kwdefaults__.get(name, ...))
    new_class = create_model(
        clas.__name__ + model_name_suffix, __base__=__base__, **field_definitions
    )
    return new_class
