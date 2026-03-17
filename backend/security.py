from __future__ import annotations

import os
from pathlib import Path

from fastapi import HTTPException, Request, UploadFile

MAX_UPLOAD_SIZE_MB = max(1, int(os.getenv("EGLC_MAX_UPLOAD_SIZE_MB", "10")))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
UPLOAD_HEADER_SLACK_BYTES = 256 * 1024


def client_ip_from_request(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        first_hop = forwarded_for.split(",", 1)[0].strip()
        if first_hop:
            return first_hop
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def validate_upload_extension(
    filename: str | None,
    *,
    allowed_extensions: tuple[str, ...],
    label: str,
) -> None:
    if not allowed_extensions:
        return

    suffix = Path(filename or "").suffix.lower()
    if suffix in allowed_extensions:
        return

    allowed = ", ".join(sorted(allowed_extensions))
    raise HTTPException(
        status_code=400,
        detail=f"{label} must use one of these file extensions: {allowed}.",
    )


def validate_content_length_header(request: Request, *, label: str) -> None:
    raw_length = request.headers.get("content-length")
    if not raw_length:
        return

    try:
        content_length = int(raw_length)
    except ValueError:
        return

    if content_length <= MAX_UPLOAD_SIZE_BYTES + UPLOAD_HEADER_SLACK_BYTES:
        return

    raise HTTPException(
        status_code=413,
        detail=f"{label} is too large. Maximum allowed size is {MAX_UPLOAD_SIZE_MB} MB.",
    )


async def read_validated_upload(
    file: UploadFile,
    *,
    request: Request,
    allowed_extensions: tuple[str, ...],
    label: str,
) -> bytes:
    validate_upload_extension(
        file.filename,
        allowed_extensions=allowed_extensions,
        label=label,
    )
    validate_content_length_header(request, label=label)

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail=f"{label} is empty.")

    if len(data) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"{label} is too large. Maximum allowed size is {MAX_UPLOAD_SIZE_MB} MB.",
        )

    return data
