from datetime import datetime, timedelta

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import License, SessionToken, User
from .security import hash_password, new_token, token_hash, verify_password
from .settings import settings


app = FastAPI(title="Nichoir16 License API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime


class LicenseOut(BaseModel):
    authorized: bool
    plan: str | None = None
    expires_at: datetime | None = None


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)


def current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    row = db.scalar(
        select(SessionToken).where(
            SessionToken.token_hash == token_hash(token),
            SessionToken.expires_at > datetime.utcnow(),
        )
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return row.user


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/dev/bootstrap")
def dev_bootstrap(db: Session = Depends(get_db)) -> dict[str, str]:
    if not settings.allow_dev_bootstrap:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dev bootstrap disabled")

    user = db.scalar(select(User).where(User.email == settings.demo_email))
    if not user:
        user = User(email=settings.demo_email, password_hash=hash_password(settings.demo_password))
        db.add(user)
        db.flush()

    license_row = db.scalar(select(License).where(License.user_id == user.id, License.plan == "dev"))
    if not license_row:
        db.add(License(user_id=user.id, plan="dev", active=True, source="dev_bootstrap"))
    else:
        license_row.active = True

    db.commit()
    return {"email": settings.demo_email, "password": settings.demo_password}


@app.post("/auth/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    raw_token = new_token()
    expires_at = datetime.utcnow() + timedelta(hours=settings.session_ttl_hours)
    db.add(SessionToken(user_id=user.id, token_hash=token_hash(raw_token), expires_at=expires_at))
    db.commit()
    return TokenOut(access_token=raw_token, expires_at=expires_at)


@app.get("/license/status", response_model=LicenseOut)
def license_status(user: User = Depends(current_user), db: Session = Depends(get_db)) -> LicenseOut:
    now = datetime.utcnow()
    license_row = db.scalar(
        select(License)
        .where(
            License.user_id == user.id,
            License.active.is_(True),
        )
        .order_by(License.created_at.desc())
    )
    if not license_row:
        return LicenseOut(authorized=False)
    if license_row.expires_at and license_row.expires_at <= now:
        return LicenseOut(authorized=False, plan=license_row.plan, expires_at=license_row.expires_at)
    return LicenseOut(authorized=True, plan=license_row.plan, expires_at=license_row.expires_at)
