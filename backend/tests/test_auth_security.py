from __future__ import annotations

import importlib
from pathlib import Path
import unittest

import auth
from fastapi import HTTPException


class AuthSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_secret = auth.AUTH_SECRET
        self.original_ttl = auth.TOKEN_TTL_SECONDS
        self.original_db_path = auth.DB_PATH
        auth.AUTH_SECRET = "unit-test-secret"
        auth.TOKEN_TTL_SECONDS = 600
        self.test_db_path = Path(__file__).with_name("test_auth_runtime.db")
        if self.test_db_path.exists():
            self.test_db_path.unlink()
        auth.DB_PATH = self.test_db_path

        import auth_router

        self.auth_router = importlib.reload(auth_router)
        self.original_public_signup_enabled = self.auth_router.PUBLIC_SIGNUP_ENABLED

    def tearDown(self) -> None:
        auth.AUTH_SECRET = self.original_secret
        auth.TOKEN_TTL_SECONDS = self.original_ttl
        auth.DB_PATH = self.original_db_path
        self.auth_router.PUBLIC_SIGNUP_ENABLED = self.original_public_signup_enabled
        if self.test_db_path.exists():
            self.test_db_path.unlink()

    def test_validate_password_requires_letter_and_number(self) -> None:
        with self.assertRaises(ValueError):
            auth.validate_password("abcdefghij")

        with self.assertRaises(ValueError):
            auth.validate_password("1234567890")

        auth.validate_password("securepass123")

    def test_resolve_token_prefers_bearer_over_cookie(self) -> None:
        token = auth.resolve_token("Bearer header-token", "cookie-token")
        self.assertEqual(token, "header-token")
        self.assertEqual(auth.resolve_token(None, "cookie-token"), "cookie-token")

    def test_issue_token_round_trip(self) -> None:
        token = auth.issue_token({"id": 7, "username": "alice", "name": "alice"})
        payload = auth.decode_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["uid"], 7)
        self.assertEqual(payload["username"], "alice")

    def test_cookie_settings_are_http_only(self) -> None:
        settings = auth.auth_cookie_settings()
        self.assertTrue(settings["httponly"])
        self.assertEqual(settings["path"], "/")

    def test_public_auth_config_reflects_signup_toggle(self) -> None:
        self.auth_router.PUBLIC_SIGNUP_ENABLED = False
        self.assertEqual(
            self.auth_router._public_auth_config_payload(),
            {"public_signup_enabled": False},
        )

        self.auth_router.PUBLIC_SIGNUP_ENABLED = True
        self.assertEqual(
            self.auth_router._public_auth_config_payload(),
            {"public_signup_enabled": True},
        )

    def test_public_signup_guard_blocks_when_disabled(self) -> None:
        self.auth_router.PUBLIC_SIGNUP_ENABLED = False
        with self.assertRaises(HTTPException):
            self.auth_router._ensure_public_signup_enabled()

        self.auth_router.PUBLIC_SIGNUP_ENABLED = True
        self.auth_router._ensure_public_signup_enabled()


if __name__ == "__main__":
    unittest.main()
