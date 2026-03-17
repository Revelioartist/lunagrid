from __future__ import annotations

import unittest

import auth


class AuthSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_secret = auth.AUTH_SECRET
        self.original_ttl = auth.TOKEN_TTL_SECONDS
        auth.AUTH_SECRET = "unit-test-secret"
        auth.TOKEN_TTL_SECONDS = 600

    def tearDown(self) -> None:
        auth.AUTH_SECRET = self.original_secret
        auth.TOKEN_TTL_SECONDS = self.original_ttl

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


if __name__ == "__main__":
    unittest.main()
