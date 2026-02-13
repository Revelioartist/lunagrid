# app.py
from __future__ import annotations

import io
import logging
import os
import re
import time
from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder

from auth_router import router as auth_router
from etl_express_gl import clean_express_gl, clean_to_csv_bytes
from report_price.router import router as report_price_router

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
ALLOW_ORIGIN_REGEX = (
    r"^http://(localhost|127\.0\.0\.1):\d+$"
    r"|^https://[a-z0-9-]+\.vercel\.app$"
)


def _log_profile(name: str, started_at: float) -> None:
    if not PROFILE_ENABLED:
        return
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    logger.info("[profile] %s %.1fms", name, elapsed_ms)

# --- CORS (สำหรับ dev + Vite proxy ก็ได้ / ไม่ใช้ก็ได้) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[*DEFAULT_CORS_ORIGINS, *EXTRA_CORS_ORIGINS],
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(report_price_router)
app.include_router(auth_router)

@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/preview")
async def preview(
    file: UploadFile = File(...),
    limit: int = Query(25, ge=5, le=200),
    lang: str = "th",
):
    """
    Returns:
      - summary
      - validation (errors / warnings)
      - preview.raw + preview.clean (rows limited)
    """
    started_at = time.perf_counter()
    try:
        data = await file.read()
        _, summary, validation, preview_payload = clean_express_gl(data, lang=lang)

        # enforce limit (frontend can request 25/50/100)
        preview_payload["raw"]["rows"] = preview_payload["raw"]["rows"][:limit]
        preview_payload["clean"]["rows"] = preview_payload["clean"]["rows"][:limit]

        payload = {
            "summary": summary,
            "validation": validation,
            "preview": preview_payload,
        }

        # ✅ สำคัญ: แปลงให้เป็น JSON-safe เสมอ
        return JSONResponse(content=jsonable_encoder(payload))

    except Exception as e:
        # ✅ ส่งข้อความ error กลับไปให้เห็นเหตุผลจริง (frontend จะแสดงเป็น row error)
        raise HTTPException(status_code=400, detail=f"Preview error: {e}")
    finally:
        _log_profile("express_preview", started_at)
    

@app.post("/api/clean")
async def clean(file: UploadFile = File(...), lang: str = "th"):
    """
    Clean & download as CSV (UTF-8-SIG)
    """
    started_at = time.perf_counter()
    try:
        data = await file.read()
        clean_df, _, _, _ = clean_express_gl(data, lang=lang)
        out_bytes = clean_to_csv_bytes(clean_df)

        # filename: BRG_29012026_CLEAN.csv (เดาจากชื่อไฟล์ input)
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

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Clean error: {e}")
    finally:
        _log_profile("express_clean", started_at)
