from datetime import timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ...core.security import create_access_token, get_password_hash, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


_fake_users_db = {
    "admin@disenyorita.example": {
        "email": "admin@disenyorita.example",
        "hashed_password": get_password_hash("changeme"),
    }
}


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest) -> TokenResponse:
    user = _fake_users_db.get(data.email)
    if not user or not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["email"], expires_delta=timedelta(minutes=30))
    return TokenResponse(access_token=token)
