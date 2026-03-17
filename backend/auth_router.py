from __future__ import annotations

import os
import threading
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from auth import (
  AUTH_COOKIE_DOMAIN,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_SAMESITE,
  AUTH_COOKIE_SECURE,
  authenticate_user,
  auth_cookie_settings,
  create_user,
  get_current_user_or_401,
  init_auth_db,
  issue_token,
)
from security import client_ip_from_request

router = APIRouter(prefix="/api/auth", tags=["auth"])
init_auth_db()

AUTH_RATE_LIMIT_WINDOW_SECONDS = max(
  60,
  int(os.getenv("EGLC_AUTH_RATE_LIMIT_WINDOW_SECONDS", "300")),
)
LOGIN_RATE_LIMIT_ATTEMPTS = max(
  3,
  int(os.getenv("EGLC_AUTH_RATE_LIMIT_ATTEMPTS", "10")),
)
SIGNUP_RATE_LIMIT_ATTEMPTS = max(
  2,
  int(os.getenv("EGLC_SIGNUP_RATE_LIMIT_ATTEMPTS", "5")),
)
PUBLIC_SIGNUP_ENABLED = os.getenv("EGLC_PUBLIC_SIGNUP_ENABLED", "0").strip().lower() in {
  "1",
  "true",
  "yes",
  "on",
}
_RATE_LIMIT_LOCK = threading.Lock()
_RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}


def _consume_rate_limit(scope: str, client_id: str, max_attempts: int) -> None:
  now = time.monotonic()
  key = f"{scope}:{client_id}"
  with _RATE_LIMIT_LOCK:
    recent_attempts = [
      stamp
      for stamp in _RATE_LIMIT_BUCKETS.get(key, [])
      if now - stamp < AUTH_RATE_LIMIT_WINDOW_SECONDS
    ]
    if len(recent_attempts) >= max_attempts:
      retry_after = max(
        1,
        int(AUTH_RATE_LIMIT_WINDOW_SECONDS - (now - recent_attempts[0])),
      )
      raise HTTPException(
        status_code=429,
        detail="Too many authentication attempts. Please try again later.",
        headers={"Retry-After": str(retry_after)},
      )

    recent_attempts.append(now)
    _RATE_LIMIT_BUCKETS[key] = recent_attempts


def _build_session_response(user: dict, token: str) -> JSONResponse:
  response = JSONResponse({"user": user})
  response.set_cookie(**auth_cookie_settings(), value=token)
  return response


def _build_logout_response() -> JSONResponse:
  response = JSONResponse({"ok": True})
  response.delete_cookie(
    key=AUTH_COOKIE_NAME,
    path="/",
    domain=AUTH_COOKIE_DOMAIN,
    secure=AUTH_COOKIE_SECURE,
    httponly=True,
    samesite=AUTH_COOKIE_SAMESITE,
  )
  return response


def _public_auth_config_payload() -> dict[str, bool]:
  return {"public_signup_enabled": PUBLIC_SIGNUP_ENABLED}


def _ensure_public_signup_enabled() -> None:
  if PUBLIC_SIGNUP_ENABLED:
    return
  raise HTTPException(
    status_code=403,
    detail="Public sign-up is disabled. Please contact the administrator.",
  )


class SignUpBody(BaseModel):
  username: str = Field(min_length=3, max_length=32)
  password: str = Field(min_length=10, max_length=128)


class LoginBody(BaseModel):
  username: str = Field(min_length=3, max_length=64)
  password: str = Field(min_length=1, max_length=128)


@router.get("/config")
def auth_config():
  return _public_auth_config_payload()


@router.post("/signup")
def signup(body: SignUpBody, request: Request):
  _ensure_public_signup_enabled()
  _consume_rate_limit(
    "signup",
    client_ip_from_request(request),
    SIGNUP_RATE_LIMIT_ATTEMPTS,
  )

  try:
    user = create_user(username=body.username, password=body.password)
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e)) from e

  token = issue_token(user)
  return _build_session_response(user, token)


@router.post("/login")
def login(body: LoginBody, request: Request):
  _consume_rate_limit(
    "login",
    client_ip_from_request(request),
    LOGIN_RATE_LIMIT_ATTEMPTS,
  )

  user = authenticate_user(username=body.username, password=body.password)
  if not user:
    raise HTTPException(status_code=401, detail="Invalid username or password.")

  token = issue_token(user)
  return _build_session_response(user, token)


@router.post("/logout")
def logout():
  return _build_logout_response()


@router.get("/me")
def me(user: dict = Depends(get_current_user_or_401)):
  return {"user": user}
