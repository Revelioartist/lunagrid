from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from auth import (
  authenticate_user,
  create_user,
  decode_token,
  extract_bearer_token,
  get_user_by_id,
  init_auth_db,
  issue_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
init_auth_db()


class SignUpBody(BaseModel):
  username: str
  password: str


class LoginBody(BaseModel):
  username: str
  password: str


@router.post("/signup")
def signup(body: SignUpBody):
  try:
    user = create_user(username=body.username, password=body.password)
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e)) from e

  token = issue_token(user)
  return {"token": token, "user": user}


@router.post("/login")
def login(body: LoginBody):
  user = authenticate_user(username=body.username, password=body.password)
  if not user:
    raise HTTPException(status_code=401, detail="Invalid username or password.")

  token = issue_token(user)
  return {"token": token, "user": user}


@router.get("/me")
def me(authorization: str | None = Header(default=None)):
  token = extract_bearer_token(authorization)
  if not token:
    raise HTTPException(status_code=401, detail="Missing bearer token.")

  payload = decode_token(token)
  if not payload:
    raise HTTPException(status_code=401, detail="Invalid or expired token.")

  user = get_user_by_id(int(payload["uid"]))
  if not user:
    raise HTTPException(status_code=401, detail="User not found.")

  return {"user": user}
