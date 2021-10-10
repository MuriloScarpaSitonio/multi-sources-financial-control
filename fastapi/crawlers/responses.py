from pydantic import BaseModel


class NotFoundResponse(BaseModel):
    detail: str
