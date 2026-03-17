from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import sqlite3
import time
from pathlib import Path

from fastapi import Cookie, Header, HTTPException

logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
  raw = os.getenv(name)
  if raw is None:
    return default
  return raw.strip().lower() in {"1", "true", "yes", "on"}


def _default_data_dir() -> Path:
  explicit_dir = os.getenv("EGLC_DATA_DIR", "").strip()
  if explicit_dir:
    return Path(explicit_dir).expanduser()

  local_app_data = os.getenv("LOCALAPPDATA", "").strip()
  if local_app_data:
    return Path(local_app_data) / "LunaGrid"

  return Path.home() / ".lunagrid"


def _normalize_same_site(raw: str) -> str:
  normalized = (raw or "lax").strip().lower()
  if normalized not in {"lax", "strict", "none"}:
    return "lax"
  return normalized


DB_PATH = Path(os.getenv("EGLC_AUTH_DB", str(_default_data_dir() / "auth.db"))).expanduser()
AUTH_SECRET = os.getenv("EGLC_AUTH_SECRET", "").strip()
if not AUTH_SECRET:
  AUTH_SECRET = secrets.token_urlsafe(48)
  logger.warning(
    "EGLC_AUTH_SECRET is not set. Using an ephemeral secret; all sessions reset on restart.",
  )

TOKEN_TTL_SECONDS = max(300, int(os.getenv("EGLC_AUTH_TTL_SECONDS", "28800")))
PASSWORD_ITERATIONS = max(
  250000,
  int(os.getenv("EGLC_AUTH_PBKDF2_ITERATIONS", "310000")),
)
AUTH_COOKIE_NAME = os.getenv("EGLC_AUTH_COOKIE_NAME", "eglc_session").strip() or "eglc_session"
AUTH_COOKIE_SECURE = _env_flag("EGLC_AUTH_COOKIE_SECURE", False)
AUTH_COOKIE_SAMESITE = _normalize_same_site(os.getenv("EGLC_AUTH_COOKIE_SAMESITE", "lax"))
AUTH_COOKIE_DOMAIN = os.getenv("EGLC_AUTH_COOKIE_DOMAIN", "").strip() or None
USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{3,32}$")

if AUTH_COOKIE_SAMESITE == "none" and not AUTH_COOKIE_SECURE:
  logger.warning(
    "EGLC_AUTH_COOKIE_SAMESITE is 'none' but EGLC_AUTH_COOKIE_SECURE is disabled. Modern browsers may reject the cookie.",
  )


def auth_cookie_settings() -> dict[str, object]:
  settings: dict[str, object] = {
    "key": AUTH_COOKIE_NAME,
    "httponly": True,
    "max_age": TOKEN_TTL_SECONDS,
    "expires": TOKEN_TTL_SECONDS,
    "path": "/",
    "secure": AUTH_COOKIE_SECURE,
    "samesite": AUTH_COOKIE_SAMESITE,
  }
  if AUTH_COOKIE_DOMAIN:
    settings["domain"] = AUTH_COOKIE_DOMAIN
  return settings


def _conn() -> sqlite3.Connection:
  DB_PATH.parent.mkdir(parents=True, exist_ok=True)
  con = sqlite3.connect(DB_PATH)
  con.row_factory = sqlite3.Row
  return con


def init_auth_db() -> None:
  with _conn() as con:
    con.execute(
      """
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
      """
    )
    con.commit()


def normalize_username(username: str) -> str:
  return (username or "").strip().lower()


def validate_username(username: str) -> bool:
  return bool(USERNAME_RE.fullmatch((username or "").strip()))


def validate_password(password: str) -> None:
  pw = password or ""
  if len(pw) < 10:
    raise ValueError("Password must be at least 10 characters.")
  if len(pw) > 128:
    raise ValueError("Password is too long.")
  if not any(ch.isalpha() for ch in pw):
    raise ValueError("Password must include at least one letter.")
  if not any(ch.isdigit() for ch in pw):
    raise ValueError("Password must include at least one number.")


def _b64url_encode(raw: bytes) -> str:
  return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(raw: str) -> bytes:
  padding = "=" * (-len(raw) % 4)
  return base64.urlsafe_b64decode(raw + padding)


def _json_dumps(payload: dict) -> bytes:
  return json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")


def hash_password(password: str) -> str:
  salt = secrets.token_bytes(16)
  key = hashlib.pbkdf2_hmac(
    "sha256",
    password.encode("utf-8"),
    salt,
    PASSWORD_ITERATIONS,
  )
  return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt.hex()}${key.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
  try:
    algo, iters_str, salt_hex, key_hex = stored_hash.split("$", 3)
    if algo != "pbkdf2_sha256":
      return False
    iters = int(iters_str)
    salt = bytes.fromhex(salt_hex)
    expected = bytes.fromhex(key_hex)
  except Exception:
    return False

  actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iters)
  return hmac.compare_digest(actual, expected)


def _user_to_public(row: sqlite3.Row) -> dict:
  username = str((row["name"] or row["email"] or "")).strip()
  email = str(row["email"] or "").strip()
  return {
    "id": int(row["id"]),
    "username": username,
    "name": username,
    "email": email,
    "created_at": str(row["created_at"]),
  }


def get_user_by_email(email: str) -> dict | None:
  normalized = normalize_username(email)
  with _conn() as con:
    row = con.execute(
      "SELECT id, name, email, created_at FROM users WHERE email = ? OR lower(name) = ?",
      (normalized, normalized),
    ).fetchone()
  return _user_to_public(row) if row else None


def get_user_by_id(user_id: int) -> dict | None:
  with _conn() as con:
    row = con.execute(
      "SELECT id, name, email, created_at FROM users WHERE id = ?",
      (int(user_id),),
    ).fetchone()
  return _user_to_public(row) if row else None


def create_user(username: str, password: str) -> dict:
  raw_username = (username or "").strip()
  normalized_username = normalize_username(raw_username)
  pw = password or ""

  if not validate_username(raw_username):
    raise ValueError("Username must be 3-32 chars and use only letters, numbers, '.', '_' or '-'.")

  validate_password(pw)

  password_hash = hash_password(pw)
  with _conn() as con:
    try:
      cur = con.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
        (raw_username, normalized_username, password_hash),
      )
      con.commit()
    except sqlite3.IntegrityError as e:
      raise ValueError("This username is already registered.") from e

    row = con.execute(
      "SELECT id, name, email, created_at FROM users WHERE id = ?",
      (cur.lastrowid,),
    ).fetchone()
  if not row:
    raise ValueError("Failed to create user.")
  return _user_to_public(row)


def authenticate_user(username: str, password: str) -> dict | None:
  normalized_username = normalize_username(username)
  with _conn() as con:
    row = con.execute(
      """
      SELECT id, name, email, password_hash, created_at
      FROM users
      WHERE email = ? OR lower(name) = ?
      """,
      (normalized_username, normalized_username),
    ).fetchone()

  if not row:
    return None
  if not verify_password(password or "", str(row["password_hash"])):
    return None
  return _user_to_public(row)


def issue_token(user: dict) -> str:
  now = int(time.time())
  header = {"alg": "HS256", "typ": "JWT"}
  payload = {
    "uid": int(user["id"]),
    "username": str(user.get("username") or user.get("name") or ""),
    "name": str(user.get("username") or user.get("name") or ""),
    "iat": now,
    "exp": now + TOKEN_TTL_SECONDS,
  }

  encoded_header = _b64url_encode(_json_dumps(header))
  encoded_payload = _b64url_encode(_json_dumps(payload))
  signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
  signature = hmac.new(
    AUTH_SECRET.encode("utf-8"),
    signing_input,
    hashlib.sha256,
  ).digest()
  encoded_sig = _b64url_encode(signature)
  return f"{encoded_header}.{encoded_payload}.{encoded_sig}"


def decode_token(token: str) -> dict | None:
  try:
    part_a, part_b, part_c = token.split(".", 2)
  except ValueError:
    return None

  signing_input = f"{part_a}.{part_b}".encode("utf-8")
  expected_sig = hmac.new(
    AUTH_SECRET.encode("utf-8"),
    signing_input,
    hashlib.sha256,
  ).digest()

  try:
    actual_sig = _b64url_decode(part_c)
  except Exception:
    return None

  if not hmac.compare_digest(expected_sig, actual_sig):
    return None

  try:
    payload = json.loads(_b64url_decode(part_b).decode("utf-8"))
  except Exception:
    return None

  exp = int(payload.get("exp", 0))
  if exp <= int(time.time()):
    return None
  return payload


def extract_bearer_token(authorization: str | None) -> str | None:
  if not authorization:
    return None
  scheme, _, token = authorization.partition(" ")
  if scheme.lower() != "bearer" or not token:
    return None
  return token.strip()


def resolve_token(
  authorization: str | None,
  session_cookie: str | None,
) -> str | None:
  bearer = extract_bearer_token(authorization)
  if bearer:
    return bearer
  if session_cookie and session_cookie.strip():
    return session_cookie.strip()
  return None


def get_current_user_or_401(
  authorization: str | None = Header(default=None),
  session_cookie: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
) -> dict:
  token = resolve_token(authorization, session_cookie)
  if not token:
    raise HTTPException(status_code=401, detail="Authentication required.")

  payload = decode_token(token)
  if not payload:
    raise HTTPException(status_code=401, detail="Invalid or expired session.")

  user = get_user_by_id(int(payload["uid"]))
  if not user:
    raise HTTPException(status_code=401, detail="User not found.")

  return user
