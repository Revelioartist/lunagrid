from __future__ import annotations

import io
import logging
import os
import time
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.encoders import jsonable_encoder

from .etl_report_price import build_transposed, df_to_xlsx_bytes, parse_report_xlsx, make_raw_preview

router = APIRouter(prefix="/api/report", tags=["report-price"])
logger = logging.getLogger(__name__)
PROFILE_ENABLED = os.getenv("EGLC_PROFILE", "0") == "1"


def _log_profile(name: str, started_at: float) -> None:
    if not PROFILE_ENABLED:
        return
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    logger.info("[profile] %s %.1fms", name, elapsed_ms)


@router.post("/preview")
async def report_preview(
    file: UploadFile = File(...),
    asset: str = Form("USD"),
    include_bot: bool = Form(True),
    coins: str = Form(""),
    limit_rows: int = Form(12),
    limit_cols: int = Form(12),
):
    started_at = time.perf_counter()
    try:
        data = await file.read()
        parsed = parse_report_xlsx(data)
        df = parsed["df"]

        selected = [c.strip() for c in (coins or "").split(",") if c.strip()]
        out_df, meta = build_transposed(
            data=data,
            asset=asset,
            include_bot=include_bot,
            coins_selected=selected,
            parsed=parsed,
        )

        raw_prev = make_raw_preview(df, max_rows=18, max_cols=max(8, int(limit_cols)))

        cols = out_df.columns.tolist()
        cols = cols[: max(3, int(limit_cols))]
        clean_prev = {
            "headers": cols,
            "rows": out_df.head(int(limit_rows)).loc[:, cols].values.tolist(),
        }

        payload = {
            "meta": meta,
            "coins": {"USD": parsed["coins_usd"], "THB": parsed["coins_thb"]},
            "rawPreview": raw_prev,
            "cleanPreview": clean_prev,
        }
        return JSONResponse(content=jsonable_encoder(payload))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Report preview error: {e}")
    finally:
        _log_profile("report_preview", started_at)


@router.post("/clean")
async def report_clean(
    file: UploadFile = File(...),
    asset: str = Form("USD"),
    include_bot: bool = Form(True),
    coins: str = Form(""),
):
    started_at = time.perf_counter()
    try:
        data = await file.read()
        selected = [c.strip() for c in (coins or "").split(",") if c.strip()]

        out_df, _ = build_transposed(
            data=data,
            asset=asset,
            include_bot=include_bot,
            coins_selected=selected,
        )
        out_bytes = df_to_xlsx_bytes(out_df)

        base = (file.filename or "report").rsplit(".", 1)[0]
        out_name = f"{base}_{asset}_CLEAN.xlsx"

        return StreamingResponse(
            io.BytesIO(out_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Report clean error: {e}")
    finally:
        _log_profile("report_clean", started_at)
