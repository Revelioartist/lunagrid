# etl.py
from __future__ import annotations

import io
import re
import datetime as dt
from typing import Tuple, Optional, Dict, Any, List

import pandas as pd


THAI_MONTHS = {
    "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
    "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
    "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4, "พฤษภาคม": 5, "มิถุนายน": 6,
    "กรกฎาคม": 7, "สิงหาคม": 8, "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
}


def _strip_ends_keep_inner_spaces(x: Any) -> str:
    """Replace NBSP and strip only the ends; keep inner spacing (match your CLEAN sample)."""
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return ""
    return str(x).replace("\xa0", " ").strip()


def _parse_num(x: Any) -> float:
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return float("nan")
    s = _strip_ends_keep_inner_spaces(x)
    if not s:
        return float("nan")
    s = s.replace(",", "").strip(" )(")  # กันเคสมีวงเล็บ/ตัวปิดท้ายแปลก ๆ
    try:
        return float(s)
    except ValueError:
        return float("nan")


def _parse_ddmmyyyy_buddhist(s: str) -> Optional[dt.date]:
    m = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", s)
    if not m:
        return None
    day, month, year = map(int, m.groups())
    return dt.date(year - 543, month, day)


def _parse_thai_word_date(s: str) -> Optional[dt.date]:
    # ตัวอย่าง: "1 ม.ค. 2568"
    s = _strip_ends_keep_inner_spaces(s)
    m = re.match(r"(\d{1,2})\s+([^\s]+)\s+(\d{4})", s)
    if not m:
        return None
    d = int(m.group(1))
    mon = m.group(2)
    y = int(m.group(3)) - 543
    mon = mon.strip()
    if mon not in THAI_MONTHS:
        mon2 = mon.rstrip(".")
        if mon2 in THAI_MONTHS:
            mon = mon2
        else:
            return None
    return dt.date(y, THAI_MONTHS[mon], d)


def _fmt_mdy(d: dt.date) -> str:
    # m/d/yyyy (ไม่บังคับเลข 0 นำหน้า)
    return f"{d.month}/{d.day}/{d.year}"


def _detect_report_start_date(df: pd.DataFrame) -> dt.date:
    # หาแถวหัวรายงานที่มี "วันที่จาก"
    for i in range(min(80, len(df))):
        v = df.iloc[i, 0]
        if isinstance(v, str) and "วันที่จาก" in v:
            cand = df.iloc[i, 1] if df.shape[1] > 1 else ""
            if isinstance(cand, str):
                d = _parse_thai_word_date(cand)
                if d:
                    return d

    # fallback: earliest transaction date
    dates: List[dt.date] = []
    for v in df[0].tolist():
        if isinstance(v, str):
            d = _parse_ddmmyyyy_buddhist(v.strip())
            if d:
                dates.append(d)
    return min(dates) if dates else dt.date.today()


def _split_voucher_and_type_if_combined(voucher_field: str) -> Tuple[str, str]:
    """
    รองรับเคส: "PV680000001 เงินฝากออมทรัพย์"
    ถ้าไม่ match → ถือว่าเป็นใบสำคัญอย่างเดียว
    """
    s = _strip_ends_keep_inner_spaces(voucher_field)
    if not s:
        return "", ""
    m = re.match(r"^([A-Z]{1,4}\d{6,})\s+(.+)$", s)
    if m:
        return m.group(1), m.group(2)
    return s, ""


def clean_express_gl_csv(file_bytes: bytes, *, lang: str = "th") -> pd.DataFrame:
    """
    คืน DataFrame ที่ Clean แล้วตามรูปแบบตัวอย่าง
    lang = "th" หรือ "en" (ชื่อหัวคอลัมน์)
    """
    # 1) Detect encoding (utf-8-sig หรือ cp874)
    if file_bytes.startswith(b"\xef\xbb\xbf"):
        text = file_bytes.decode("utf-8-sig", errors="replace")
    else:
        # Express ไทยส่วนใหญ่เป็น cp874
        text = file_bytes.decode("cp874", errors="replace")

    # 2) อ่านเป็นตารางดิบ
    df = pd.read_csv(io.StringIO(text), header=None, engine="python")
    report_start = _detect_report_start_date(df)

    records: List[Dict[str, Any]] = []

    cur_acc: Optional[int] = None
    cur_type: str = ""
    opening_balance = float("nan")
    has_tx = False

    def finalize_account_if_no_tx():
        nonlocal cur_acc, cur_type, opening_balance, has_tx
        if cur_acc is not None and (not has_tx) and (not pd.isna(opening_balance)):
            records.append({
                "account": cur_acc,
                "date": _fmt_mdy(report_start),
                "voucher": "",
                "description": "",
                "type": cur_type,
                "debit": float("nan"),
                "credit": float("nan"),
                "balance": float(opening_balance),
                "value": 0.0,
                "_sort_date": report_start,
            })

    # 3) ไล่แถวแบบ state machine (เหมือนอ่าน report)
    for _, row in df.iterrows():
        c0 = row[0]
        s0 = _strip_ends_keep_inner_spaces(c0)

        # account header row
        if re.fullmatch(r"\d{6,}", s0):
            finalize_account_if_no_tx()

            cur_acc = int(s0)
            cur_type = _strip_ends_keep_inner_spaces(row[2]) if df.shape[1] > 2 else ""
            opening_balance = _parse_num(row[8]) if df.shape[1] > 8 else float("nan")
            has_tx = False
            continue

        # transaction row (date dd/mm/yyyy พ.ศ.)
        d = _parse_ddmmyyyy_buddhist(s0)
        if d and cur_acc is not None:
            has_tx = True

            voucher_raw = _strip_ends_keep_inner_spaces(row[2]) if df.shape[1] > 2 else ""
            desc = _strip_ends_keep_inner_spaces(row[3]) if df.shape[1] > 3 else ""

            debit = _parse_num(row[5]) if df.shape[1] > 5 else float("nan")
            credit = _parse_num(row[6]) if df.shape[1] > 6 else float("nan")
            bal = _parse_num(row[8]) if df.shape[1] > 8 else float("nan")

            tx_type = cur_type

            # fallback: ถ้าประเภทว่าง แต่ใบสำคัญมี "ติดประเภทมาด้วย"
            if not tx_type and voucher_raw:
                v, t = _split_voucher_and_type_if_combined(voucher_raw)
                voucher = v
                tx_type = t
            else:
                voucher = voucher_raw

            prefix = str(cur_acc)[0]
            dv = 0.0 if pd.isna(debit) else float(debit)
            cv = 0.0 if pd.isna(credit) else float(credit)

            if prefix in {"1", "5"}:
                value = dv - cv
            else:
                value = cv - dv

            records.append({
                "account": cur_acc,
                "date": _fmt_mdy(d),
                "voucher": voucher,
                "description": desc,
                "type": tx_type,
                "debit": float("nan") if pd.isna(debit) else float(debit),
                "credit": float("nan") if pd.isna(credit) else float(credit),
                "balance": float("nan") if pd.isna(bal) else float(bal),
                "value": float(value),
                "_sort_date": d,
            })

    finalize_account_if_no_tx()

    out = pd.DataFrame(records)
    out = out.sort_values(by=["account", "_sort_date", "voucher"], kind="mergesort").drop(columns=["_sort_date"])

    # 4) ตั้งชื่อคอลัมน์ตามภาษา
    if lang.lower() == "en":
        out = out.rename(columns={
            "account": "Account",
            "date": "Date",
            "voucher": "Voucher",
            "description": "Description",
            "type": "Type",
            "debit": "Debit",
            "credit": "Credit",
            "balance": "Balance",
            "value": "Value",
        })
        # reorder
        out = out[["Account", "Date", "Voucher", "Description", "Type", "Debit", "Credit", "Balance", "Value"]]
    else:
        out = out.rename(columns={
            "account": "เลขบัญชี",
            "date": "วันที่",
            "voucher": "ใบสำคัญ",
            "description": "คำอธิบาย",
            "type": "ประเภท",
            "debit": "เดบิต",
            "credit": "เครดิต",
            "balance": "ยอดคงเหลือ",
            "value": "Value",
        })
        out = out[["เลขบัญชี", "วันที่", "ใบสำคัญ", "คำอธิบาย", "ประเภท", "เดบิต", "เครดิต", "ยอดคงเหลือ", "Value"]]

    return out
