from __future__ import annotations

import io
from typing import Any, Dict, List, Tuple

import pandas as pd


def _s(x: Any) -> str:
    if x is None:
        return ""
    if isinstance(x, float) and pd.isna(x):
        return ""
    return str(x).strip()


def _dedupe_headers(items: List[str]) -> List[str]:
    seen: Dict[str, int] = {}
    out: List[str] = []
    for it in items:
        k = it
        if k in seen:
            seen[k] += 1
            out.append(f"{k}.{seen[k]}")
        else:
            seen[k] = 0
            out.append(k)
    return out


def _norm_key(x: Any) -> str:
    return "".join(ch for ch in _s(x).lower() if ch.isalnum())


def _find_row_exact(df: pd.DataFrame, label: str) -> int:
    col0 = df.iloc[:, 0].astype(str).str.strip().str.lower()
    target = label.strip().lower()
    hits = df.index[col0 == target].tolist()
    if not hits:
        raise ValueError(f"Missing row: {label}")
    return hits[0]


def _looks_like_section_row(df: pd.DataFrame, row: int) -> bool:
    # Asset headers are normally marker rows: label in col 0 and almost-empty rest.
    sample_end = min(df.shape[1], 9)
    non_blank = 0
    for c in range(1, sample_end):
        if _s(df.iat[row, c]) != "":
            non_blank += 1
    return non_blank <= 1


def _find_asset_rows(df: pd.DataFrame) -> Tuple[int, int]:
    labels = [_s(df.iat[r, 0]) for r in range(df.shape[0])]
    keys = [_norm_key(v) for v in labels]

    def match_rows(token: str) -> List[int]:
        strict = {
            i
            for i, k in enumerate(keys)
            if k in {f"asset{token}", f"{token}asset", f"assets{token}"}
        }
        mixed = {
            i
            for i, k in enumerate(keys)
            if "asset" in k and token in k
        }
        section_only = {
            i
            for i, k in enumerate(keys)
            if token in k and _looks_like_section_row(df, i)
        }
        return sorted(strict | mixed | section_only)

    usd = match_rows("usd")
    thb = match_rows("thb")
    if usd and thb:
        return usd[0], thb[0]

    sample_labels = [v for v in labels if v][:10]
    sample = ", ".join(sample_labels) if sample_labels else "-"
    raise ValueError(
        "Missing asset (USD) or asset (THB) row"
        f" | sample labels: {sample}"
    )


def _date_col_indices(df: pd.DataFrame, date_row: int) -> List[int]:
    idx = []
    for c in range(1, df.shape[1]):
        v = _s(df.iat[date_row, c])
        if v != "":
            idx.append(c)
    if not idx:
        raise ValueError("No date columns found")
    return idx


def _extract_dates(df: pd.DataFrame, date_row: int, cols: List[int]) -> List[str]:
    return [_s(df.iat[date_row, c]) for c in cols]


def _to_float(x: Any) -> float | None:
    if x is None:
        return None
    if isinstance(x, float) and pd.isna(x):
        return None
    try:
        return float(x)
    except Exception:
        s = str(x).replace(",", "").strip()
        if s == "":
            return None
        try:
            return float(s)
        except Exception:
            return None


def _row_values(df: pd.DataFrame, row: int, cols: List[int]) -> List[float | None]:
    return [_to_float(df.iat[row, c]) for c in cols]


def _extract_coins(df: pd.DataFrame, start_row: int, end_row: int) -> List[str]:
    coins: List[str] = []
    for r in range(start_row + 1, end_row):
        name = _s(df.iat[r, 0])
        if name == "":
            continue
        low = name.lower()
        if low in {"date", "timestamp", "bot rate", "asset (usd)", "asset (thb)"}:
            continue
        coins.append(name)

    # unique preserve order
    seen = set()
    uniq = []
    for c in coins:
        k = c.strip().lower()
        if k in seen:
            continue
        seen.add(k)
        uniq.append(c)
    return uniq


def parse_report_xlsx(data: bytes) -> Dict[str, Any]:
    df = pd.read_excel(io.BytesIO(data), header=None, engine="openpyxl")

    date_row = _find_row_exact(df, "Date")
    # optional
    try:
        bot_row = _find_row_exact(df, "BOT rate")
    except Exception:
        bot_row = None

    usd_row, thb_row = _find_asset_rows(df)

    cols = _date_col_indices(df, date_row)
    dates = _extract_dates(df, date_row, cols)

    coins_usd = _extract_coins(df, usd_row, thb_row)
    coins_thb = _extract_coins(df, thb_row, df.shape[0])

    bot_vals = None
    if bot_row is not None:
        bot_vals = _row_values(df, bot_row, cols)

    return {
        "df": df,
        "date_row": date_row,
        "bot_row": bot_row,
        "usd_row": usd_row,
        "thb_row": thb_row,
        "cols": cols,
        "dates": dates,
        "bot_vals": bot_vals,
        "coins_usd": coins_usd,
        "coins_thb": coins_thb,
    }


def build_transposed(
    data: bytes,
    asset: str,
    include_bot: bool,
    coins_selected: List[str],
    parsed: Dict[str, Any] | None = None,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    p = parsed if parsed is not None else parse_report_xlsx(data)
    df: pd.DataFrame = p["df"]
    cols: List[int] = p["cols"]
    dates: List[str] = p["dates"]

    asset = (asset or "USD").upper()
    if asset not in {"USD", "THB"}:
        raise ValueError("asset must be USD or THB")

    if asset == "USD":
        start = p["usd_row"]
        end = p["thb_row"]
        available = p["coins_usd"]
    else:
        start = p["thb_row"]
        end = df.shape[0]
        available = p["coins_thb"]

    # map coin name -> row index (case-insensitive)
    row_map: Dict[str, int] = {}
    for r in range(start + 1, end):
        name = _s(df.iat[r, 0])
        if name == "":
            continue
        row_map[name.strip().lower()] = r

    out: Dict[str, List[Any]] = {"Date": dates}

    if include_bot and p["bot_row"] is not None and p["bot_vals"] is not None:
        out["BOT rate"] = p["bot_vals"]

    missing: List[str] = []
    for coin in coins_selected:
        key = coin.strip().lower()
        r = row_map.get(key)
        if r is None:
            missing.append(coin)
            continue
        out[coin] = _row_values(df, r, cols)

    out_df = pd.DataFrame(out)

    meta = {
        "asset": asset,
        "include_bot": bool(include_bot),
        "total_coins": len(available),
        "selected_coins": len(coins_selected),
        "missing_coins": missing,
        "rows": len(out_df),
        "available_coins": available,
    }
    return out_df, meta


def df_to_xlsx_bytes(df: pd.DataFrame) -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name="Report")
    return buf.getvalue()


def make_raw_preview(df: pd.DataFrame, max_rows: int = 18, max_cols: int = 12) -> Dict[str, Any]:
    # use Date row as header for date columns when possible
    try:
        date_row = _find_row_exact(df, "Date")
    except Exception:
        date_row = None

    headers = ["Label"]
    if date_row is not None:
        raw_dates = [_s(df.iat[date_row, c]) for c in range(1, min(df.shape[1], max_cols))]
        headers += _dedupe_headers([d if d else f"Col{c}" for c, d in enumerate(raw_dates, start=1)])
    else:
        headers += [f"Col{i}" for i in range(1, max_cols)]

    rows: List[List[str]] = []
    for r in range(0, min(df.shape[0], max_rows)):
        label = _s(df.iat[r, 0])
        vals = [_s(df.iat[r, c]) for c in range(1, min(df.shape[1], max_cols))]
        rows.append([label] + vals)

    return {"headers": headers, "rows": rows}
