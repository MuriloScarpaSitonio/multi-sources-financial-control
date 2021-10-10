from sqlmodel import Session, select

from .models import User


async def get_user(db: Session, username: str) -> str:
    statement = select(User).where(User.username == username)
    return db.exec(statement).first()
