# Security Notes

This project now avoids committing auth/session secrets and local auth data by default, but if sensitive files were already pushed to a public repository, you should still treat them as exposed.

## Recommended setup

1. Copy `.env.example` to `.env`.
2. Set `EGLC_AUTH_SECRET` to a long random value.
3. Keep `EGLC_AUTH_DB` outside the repository, or leave it empty so the app uses the OS user data directory.
4. Set `CORS_ALLOW_ORIGINS` to only the exact frontend URLs that should talk to the API.
5. Set `EGLC_ALLOWED_HOSTS` in production.
6. Set `EGLC_AUTH_COOKIE_SECURE=1` when serving over HTTPS.
7. Keep `EGLC_PUBLIC_SIGNUP_ENABLED=0` unless you intentionally want public self-registration.

## If secrets or data were already pushed

Do all of these:

1. Rotate every exposed secret immediately.
2. Delete or reset any user data that was stored in a committed database file.
3. Remove sensitive files from git history with a history-rewrite tool such as `git filter-repo` or BFG Repo-Cleaner.
4. Force-push the cleaned history.
5. Invalidate old sessions after rotating `EGLC_AUTH_SECRET`.

## Files that should stay out of git

- `.env`
- local database files such as `backend/auth.db`
- `__pycache__`
- frontend build output and `node_modules`

## Public repo guidance

- Keep the repository public only for source code, never for live data or secrets.
- Use mock or anonymized sample files when you need examples in the repo.
- Disable public self-signup unless the product is meant for open registration.
