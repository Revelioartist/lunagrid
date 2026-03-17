from __future__ import annotations

import io
import logging
import os
import re
import time

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from auth import get_current_user_or_401
from auth_router import router as auth_router
from etl_express_gl import clean_express_gl, clean_to_csv_bytes
from report_price.router import router as report_price_router
from security import read_validated_upload

app = FastAPI()
logger = logging.getLogger(__name__)
PROFILE_ENABLED = os.getenv("EGLC_PROFILE", "0") == "1"
DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
EXTRA_CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOW_ORIGINS", "").split(",")
    if origin.strip()
]
ALLOW_ORIGIN_REGEX = os.getenv("CORS_ALLOW_ORIGIN_REGEX", "").strip() or None
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("EGLC_ALLOWED_HOSTS", "").split(",")
    if host.strip()
]


def _log_profile(name: str, started_at: float) -> None:
    if not PROFILE_ENABLED:
        return
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    logger.info("[profile] %s %.1fms", name, elapsed_ms)


if ALLOWED_HOSTS:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[*DEFAULT_CORS_ORIGINS, *EXTRA_CORS_ORIGINS],
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
    )
    if request.url.scheme == "https":
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains",
        )
    if request.url.path.startswith("/api/") and request.url.path != "/api/health":
        response.headers.setdefault("Cache-Control", "no-store")
    return response


app.include_router(report_price_router)
app.include_router(auth_router)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/preview")
async def preview(
    request: Request,
    file: UploadFile = File(...),
    limit: int = Query(25, ge=5, le=200),
    lang: str = "th",
    _: dict = Depends(get_current_user_or_401),
):
    """
    Returns:
      - summary
      - validation (errors / warnings)
      - preview.raw + preview.clean (rows limited)
    """
    started_at = time.perf_counter()
    try:
        data = await read_validated_upload(
            file,
            request=request,
            allowed_extensions=(".csv",),
            label="CSV file",
        )
        _, summary, validation, preview_payload = clean_express_gl(data, lang=lang)

        preview_payload["raw"]["rows"] = preview_payload["raw"]["rows"][:limit]
        preview_payload["clean"]["rows"] = preview_payload["clean"]["rows"][:limit]

        payload = {
            "summary": summary,
            "validation": validation,
            "preview": preview_payload,
        }
        return JSONResponse(content=jsonable_encoder(payload))

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Preview error: {e}") from e
    finally:
        _log_profile("express_preview", started_at)


@app.post("/api/clean")
async def clean(
    request: Request,
    file: UploadFile = File(...),
    lang: str = "th",
    _: dict = Depends(get_current_user_or_401),
):
    """
    Clean & download as CSV (UTF-8-SIG)
    """
    started_at = time.perf_counter()
    try:
        data = await read_validated_upload(
            file,
            request=request,
            allowed_extensions=(".csv",),
            label="CSV file",
        )
        clean_df, _, _, _ = clean_express_gl(data, lang=lang)
        out_bytes = clean_to_csv_bytes(clean_df)

        original = file.filename or "UPLOAD.csv"
        m = re.search(r"_([A-Za-z]{2,10})_GL_(\d{8})", original)
        if m:
            company = m.group(1).upper()
            ddmmyyyy = m.group(2)
            out_name = f"{company}_{ddmmyyyy}_CLEAN.csv"
        else:
            out_name = "CLEAN.csv"

        headers = {
            "Content-Disposition": f'attachment; filename="{out_name}"',
        }
        return StreamingResponse(
            io.BytesIO(out_bytes),
            media_type="text/csv; charset=utf-8",
            headers=headers,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Clean error: {e}") from e
    finally:
        _log_profile("express_clean", started_at)
