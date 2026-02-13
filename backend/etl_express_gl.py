from __future__ import annotations

import io
import re
import math
from datetime import datetime
from typing import Any, Dict, List, Tuple, Optional

import numpy as np
import pandas as pd


# -----------------------------
# Utils
# -----------------------------
TH_MONTH = {
    "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
    "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12
}

DATE_RE = r"^\d{1,2}/\d{1,2}/\d{4}$"      # dd/mm/yyyy (BE)
ACCT_RE = r"^\d{6,8}$"                   # account number


def _norm(x: Any) -> str:
    if x is None:
        return ""
    if isinstance(x, float) and math.isnan(x):
        return ""
    s = str(x)
    s = s.replace("\ufffd", "")  # ลบ �
    s = s.replace("\xa0", " ").replace("\u200b", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _read_raw_csv_bytes(data: bytes) -> pd.DataFrame:
    def decode_best(b: bytes) -> str:
        for enc in ["cp874", "iso-8859-11", "tis-620", "utf-8-sig", "utf-8"]:
            try:
                return b.decode(enc, errors="strict")
            except Exception:
                pass
        # last resort: ignore (ไม่สร้าง �)
        return b.decode("cp874", errors="ignore")

    text = decode_best(data)

    head = "\n".join(text.splitlines()[:5])
    sep = ";" if head.count(";") > head.count(",") else ","

    return pd.read_csv(
        io.StringIO(text),
        header=None,
        dtype=str,
        sep=sep,
        engine="python",
        on_bad_lines="skip",
    )



def _to_num(series: pd.Series) -> pd.Series:
    s = series.fillna("").astype(str)
    s = s.str.replace("\xa0", " ", regex=False)
    s = s.str.replace(",", "", regex=False).str.replace(" ", "", regex=False)
    s = s.replace({"": np.nan, "-": np.nan})
    return pd.to_numeric(s, errors="coerce")


def _parse_be_date_series(s: pd.Series) -> pd.Series:
    """Vector parse dd/mm/yyyy (BE) -> datetime (AD)"""
    parts = s.str.split("/", expand=True)
    if parts.shape[1] < 3:
        return pd.Series([pd.NaT] * len(s), index=s.index)

    d = pd.to_numeric(parts[0], errors="coerce")
    m = pd.to_numeric(parts[1], errors="coerce")
    y = pd.to_numeric(parts[2], errors="coerce") - 543

    dt = pd.to_datetime({"year": y, "month": m, "day": d}, errors="coerce")
    return dt


def _parse_report_start_date(df: pd.DataFrame) -> Optional[datetime]:
    """
    Read "วันที่จาก" row (Thai month text e.g. "1 ม.ค. 2568")
    Returns datetime(AD) if found.
    """
    # df is already normalized, columns are 0..8
    mask = df[0].str.contains("วันที่จาก", regex=False, na=False)
    if not mask.any():
        return None

    idx = df.index[mask][0]
    raw = _norm(df.loc[idx, 1])
    m = re.search(r"(\d{1,2})\s*([^\s]+)\s*(\d{4})", raw)
    if not m:
        return None

    dd = int(m.group(1))
    mon_txt = m.group(2)
    yy_be = int(m.group(3))
    if mon_txt not in TH_MONTH:
        return None

    return datetime(yy_be - 543, TH_MONTH[mon_txt], dd)


def _make_json_safe(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    safe = []
    for r in rows:
        out = {}
        for k, v in r.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                out[k] = None
            elif isinstance(v, (np.integer, np.floating)):
                out[k] = v.item()
            else:
                out[k] = v
        safe.append(out)
    return safe


def _msg(lang: str, en: str, th: str) -> str:
    return th if (lang or "").lower().startswith("th") else en


# -----------------------------
# Core ETL
# -----------------------------
def clean_express_gl(data: bytes, lang: str = "th") -> Tuple[pd.DataFrame, Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    """
    Returns:
      clean_df: output columns 9 as required
      summary: report summary
      validation: error/warn details
      preview: raw/clean preview data payload
    """
    raw = _read_raw_csv_bytes(data)

    # ensure at least 9 cols (Express export sample has 9)
    raw = raw.copy()
    while raw.shape[1] < 9:
        raw[raw.shape[1]] = np.nan
    raw = raw.iloc[:, :9]

    # normalize all cells
    for c in range(9):
        raw[c] = raw[c].apply(_norm)

    col0 = raw[0]

    is_acct = col0.str.match(ACCT_RE, na=False)
    is_txn = col0.str.match(DATE_RE, na=False)

    # forward fill account + type from account header rows
    raw["Account"] = np.where(is_acct, raw[0], np.nan)
    raw["Type"] = np.where(is_acct, raw[2], np.nan)
    raw["Account"] = pd.Series(raw["Account"]).ffill()
    raw["Type"] = pd.Series(raw["Type"]).ffill()

    txn = raw[is_txn].copy()
    txn_dt = _parse_be_date_series(txn[0])

    debit = _to_num(txn[5])
    credit = _to_num(txn[6])
    balance = _to_num(txn[8])

    voucher = txn[2].replace({"": np.nan})
    desc = txn[3].replace({"": np.nan})

    acct = txn["Account"]
    typ = txn["Type"].replace({"": np.nan})

    # Value calculation (treat NaN as 0 for formula)
    debit0 = debit.fillna(0)
    credit0 = credit.fillna(0)
    prefix = acct.astype(str).str[:1]

    value = np.where(
        prefix.isin(["1", "5"]),
        debit0 - credit0,
        np.where(prefix.isin(["2", "3", "4"]), credit0 - debit0, np.nan),
    )

    # format date (m/d/yyyy)
    date_str = (
        txn_dt.dt.month.astype("Int64").astype(str)
        + "/"
        + txn_dt.dt.day.astype("Int64").astype(str)
        + "/"
        + txn_dt.dt.year.astype("Int64").astype(str)
    )
    date_str = date_str.where(txn_dt.notna(), None)

    clean = pd.DataFrame(
        {
            "เลขบัญชี": pd.to_numeric(acct, errors="coerce").astype("Int64"),
            "วันที่": date_str,
            "ใบสำคัญ": voucher,
            "คำอธิบาย": desc,
            "ประเภท": typ,
            "เดบิต": debit,
            "เครดิต": credit,
            "ยอดคงเหลือ": balance,
            "Value": value,
            "_dt": txn_dt,
        }
    )

    # ---- Opening balance rows (accounts that have balance in header but NO txn rows)
    start_dt = _parse_report_start_date(raw)
    if start_dt is None:
        if txn_dt.notna().any():
            y = int(txn_dt.dropna().dt.year.min())
            start_dt = datetime(y, 1, 1)
        else:
            start_dt = datetime(datetime.now().year, 1, 1)

    start_str = f"{start_dt.month}/{start_dt.day}/{start_dt.year}"

    acct_headers = raw[is_acct].copy()
    acct_headers["acct_num"] = pd.to_numeric(acct_headers[0], errors="coerce").astype("Int64")
    acct_headers["bal"] = _to_num(acct_headers[8])
    acct_headers["type"] = acct_headers[2].replace({"": np.nan})

    txn_accounts = set(clean["เลขบัญชี"].dropna().astype(int).unique().tolist())
    opening = acct_headers[
        acct_headers["bal"].notna()
        & acct_headers["acct_num"].notna()
        & (~acct_headers["acct_num"].astype(int).isin(txn_accounts))
    ].copy()

    if len(opening) > 0:
        opening_rows = pd.DataFrame(
            {
                "เลขบัญชี": opening["acct_num"].astype("Int64"),
                "วันที่": start_str,
                "ใบสำคัญ": np.nan,
                "คำอธิบาย": np.nan,
                "ประเภท": opening["type"],
                "เดบิต": np.nan,
                "เครดิต": np.nan,
                "ยอดคงเหลือ": opening["bal"],
                "Value": 0.0,
                "_dt": start_dt,
            }
        )
        clean = pd.concat([clean, opening_rows], ignore_index=True)

    # keep only valid parsed dates
    clean = clean[clean["_dt"].notna()].copy()

    # sort: by account, date, voucher (stable)
    clean.sort_values(by=["เลขบัญชี", "_dt", "ใบสำคัญ"], inplace=True, kind="mergesort")
    clean.drop(columns=["_dt"], inplace=True)

    # -----------------------------
    # Validation
    # -----------------------------
    errors: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []

    total_lines = int(raw.shape[0])
    acct_headers_count = int(is_acct.sum())
    txn_candidate_count = int(is_txn.sum())
    clean_rows = int(clean.shape[0])

    if acct_headers_count == 0:
        errors.append(
            {
                "row": 1,
                "field": "Account",
                "message": _msg(lang, "Could not detect account header rows.", "ไม่พบแถวหัวบัญชี (เลขบัญชี) ในไฟล์"),
            }
        )

    if txn_candidate_count == 0:
        errors.append(
            {
                "row": 1,
                "field": "Date",
                "message": _msg(lang, "Could not detect transaction rows (date dd/mm/yyyy).", "ไม่พบแถวรายการ (วันที่ dd/mm/พ.ศ.) ในไฟล์"),
            }
        )

    # per-txn checks
    txn_rows = raw[is_txn].copy()
    txn_rows["_row"] = txn_rows.index + 1  # 1-based line number in CSV

    # voucher missing (warning)
    v = txn_rows[2].apply(_norm)
    miss_v = v.eq("")
    if miss_v.any():
        for r in txn_rows.loc[miss_v, "_row"].head(50).tolist():
            warnings.append(
                {
                    "row": int(r),
                    "field": "Voucher",
                    "message": _msg(lang, "Voucher is empty (allowed but check if expected).", "ใบสำคัญว่าง (อนุญาตได้ แต่ควรตรวจสอบ)"),
                }
            )

    # debit/credit non-numeric (error)
    d_raw = txn_rows[5].apply(_norm)
    c_raw = txn_rows[6].apply(_norm)
    d_num = _to_num(txn_rows[5])
    c_num = _to_num(txn_rows[6])

    bad_debit = d_raw.ne("") & d_num.isna()
    bad_credit = c_raw.ne("") & c_num.isna()

    if bad_debit.any():
        for r in txn_rows.loc[bad_debit, "_row"].head(50).tolist():
            errors.append(
                {
                    "row": int(r),
                    "field": "Debit",
                    "message": _msg(lang, "Debit is not a valid number.", "เดบิตไม่ใช่ตัวเลขที่ถูกต้อง"),
                }
            )

    if bad_credit.any():
        for r in txn_rows.loc[bad_credit, "_row"].head(50).tolist():
            errors.append(
                {
                    "row": int(r),
                    "field": "Credit",
                    "message": _msg(lang, "Credit is not a valid number.", "เครดิตไม่ใช่ตัวเลขที่ถูกต้อง"),
                }
            )

    # account prefix invalid (warning)
    acct_ff = raw.loc[is_txn, "Account"].astype(str).str[:1]
    bad_prefix = ~acct_ff.isin(list("12345"))
    if bad_prefix.any():
        bad_rows = raw.loc[is_txn].copy()
        bad_rows["_row"] = bad_rows.index + 1
        for r in bad_rows.loc[bad_prefix, "_row"].head(50).tolist():
            warnings.append(
                {
                    "row": int(r),
                    "field": "Account",
                    "message": _msg(lang, "Account prefix is not 1–5 (check chart of accounts).", "เลขบัญชีไม่ได้ขึ้นต้นด้วย 1–5 (ควรตรวจสอบผังบัญชี)"),
                }
            )

    validation = {
        "error_count": len(errors),
        "warning_count": len(warnings),
        "errors": errors,
        "warnings": warnings,
    }

    # -----------------------------
    # Summary
    # -----------------------------
    # Use numeric columns from clean (sum with NaN ignored)
    summary = {
        "total_lines": total_lines,
        "account_headers": acct_headers_count,
        "txn_candidate_rows": txn_candidate_count,
        "clean_rows": clean_rows,
        "dropped_non_txn_rows": int(total_lines - acct_headers_count - txn_candidate_count),
        "dropped_invalid_rows": int(txn_candidate_count - (clean_rows - len(opening))),  # approx
        "unique_accounts": int(clean["เลขบัญชี"].nunique(dropna=True)),
        "date_min": None,
        "date_max": None,
        "sum_debit": float(np.nansum(clean["เดบิต"].to_numpy(dtype=float))),
        "sum_credit": float(np.nansum(clean["เครดิต"].to_numpy(dtype=float))),
        "sum_value": float(np.nansum(clean["Value"].to_numpy(dtype=float))),
    }

    # date range
    # parse the output date string back to datetime for range only (cheap)
    try:
        dts = pd.to_datetime(clean["วันที่"], format="%m/%d/%Y", errors="coerce")
        if dts.notna().any():
            dmin = dts.min()
            dmax = dts.max()
            summary["date_min"] = f"{int(dmin.month)}/{int(dmin.day)}/{int(dmin.year)}"
            summary["date_max"] = f"{int(dmax.month)}/{int(dmax.day)}/{int(dmax.year)}"
    except Exception:
        pass

    # -----------------------------
    # Preview (Raw vs Clean)
    # -----------------------------
    # raw preview: show txn rows but with ffilled Account/Type for clarity
    raw_prev = raw[is_txn].copy()
    raw_prev["_row"] = raw_prev.index + 1
    raw_prev["เลขบัญชี"] = pd.to_numeric(raw_prev["Account"], errors="coerce")
    raw_prev["ประเภท(จากหัวบัญชี)"] = raw_prev["Type"].replace({"": np.nan})
    raw_prev = raw_prev.rename(
        columns={
            0: "วันที่(พ.ศ.)",
            1: "สมุด",
            2: "ใบสำคัญ(ดิบ)",
            3: "คำอธิบาย(ดิบ)",
            5: "เดบิต(ดิบ)",
            6: "เครดิต(ดิบ)",
            8: "ยอดคงเหลือ(ดิบ)",
        }
    )

    raw_preview_cols = [
        "_row",
        "เลขบัญชี",
        "วันที่(พ.ศ.)",
        "สมุด",
        "ใบสำคัญ(ดิบ)",
        "คำอธิบาย(ดิบ)",
        "ประเภท(จากหัวบัญชี)",
        "เดบิต(ดิบ)",
        "เครดิต(ดิบ)",
        "ยอดคงเหลือ(ดิบ)",
    ]
    raw_preview_rows = raw_prev[raw_preview_cols].head(25).replace({np.nan: None}).to_dict(orient="records")

    clean_prev = clean.copy()
    clean_prev.insert(0, "_row", range(1, len(clean_prev) + 1))
    clean_preview_cols = ["_row"] + list(clean.columns)
    clean_preview_rows = clean_prev[clean_preview_cols].head(25).replace({np.nan: None}).to_dict(orient="records")

    preview = {
        "raw": {"columns": raw_preview_cols, "rows": _make_json_safe(raw_preview_rows)},
        "clean": {"columns": clean_preview_cols, "rows": _make_json_safe(clean_preview_rows)},
    }

    return clean, summary, validation, preview


def clean_to_csv_bytes(clean_df: pd.DataFrame) -> bytes:
    buf = io.StringIO()
    clean_df.to_csv(buf, index=False, lineterminator="\r\n")
    return buf.getvalue().encode("utf-8-sig")


