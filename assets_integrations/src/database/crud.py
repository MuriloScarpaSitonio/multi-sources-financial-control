from typing import Optional

from fastapi import HTTPException, status

from sqlmodel import Session, select

from .models import User


async def get_user(db: Session, username: str, raise_http_exception: bool = True) -> Optional[User]:
    statement = select(User).where(User.username == username)
    user = db.exec(statement).first()
    if user is None and raise_http_exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
