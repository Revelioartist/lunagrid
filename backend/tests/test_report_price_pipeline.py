from __future__ import annotations

import io
import unittest

import pandas as pd

from report_price.etl_report_price import (
    build_transposed,
    df_to_xlsx_bytes,
    parse_report_xlsx,
)


def make_report_bytes() -> bytes:
    rows = [
        ["Date", "1/1/2025", "1/2/2025", "1/3/2025"],
        ["BOT rate", 35.0, 35.1, 35.2],
        ["Asset (USD)", "", "", ""],
        ["BTC", 100.0, 110.0, 120.0],
        ["ETH", 200.0, 210.0, 220.0],
        ["Asset (THB)", "", "", ""],
        ["BTC", 3500000.0, 3600000.0, 3700000.0],
        ["XRP", 2.5, 2.6, 2.7],
    ]
    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, header=False, sheet_name="Report")
    return buf.getvalue()


class ReportPricePipelineTests(unittest.TestCase):
    def test_parse_report_xlsx_detects_coins_and_rows(self) -> None:
        data = make_report_bytes()
        parsed = parse_report_xlsx(data)

        self.assertEqual(parsed["dates"], ["1/1/2025", "1/2/2025", "1/3/2025"])
        self.assertEqual(parsed["coins_usd"], ["BTC", "ETH"])
        self.assertEqual(parsed["coins_thb"], ["BTC", "XRP"])
        self.assertIsNotNone(parsed["bot_row"])
        self.assertEqual(parsed["bot_vals"], [35.0, 35.1, 35.2])

    def test_parse_report_xlsx_supports_flexible_asset_labels(self) -> None:
        rows = [
            ["Date", "1/1/2025", "1/2/2025"],
            ["BOT rate", 35.0, 35.1],
            ["Asset USD", "", ""],
            ["BTC", 100.0, 110.0],
            ["ETH", 200.0, 210.0],
            ["THB", "", ""],
            ["BTC", 3500000.0, 3600000.0],
            ["XRP", 2.5, 2.6],
        ]
        df = pd.DataFrame(rows)
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, header=False, sheet_name="Report")

        parsed = parse_report_xlsx(buf.getvalue())
        self.assertEqual(parsed["coins_usd"], ["BTC", "ETH"])
        self.assertEqual(parsed["coins_thb"], ["BTC", "XRP"])

    def test_build_transposed_respects_filters_and_missing(self) -> None:
        data = make_report_bytes()
        parsed = parse_report_xlsx(data)

        out_df, meta = build_transposed(
            data=data,
            asset="USD",
            include_bot=True,
            coins_selected=["BTC", "MISSING"],
            parsed=parsed,
        )

        self.assertEqual(out_df.columns.tolist(), ["Date", "BOT rate", "BTC"])
        self.assertEqual(out_df.shape, (3, 3))
        self.assertEqual(out_df["BTC"].tolist(), [100.0, 110.0, 120.0])
        self.assertEqual(meta["missing_coins"], ["MISSING"])
        self.assertEqual(meta["total_coins"], 2)

    def test_export_xlsx_round_trip_regression(self) -> None:
        data = make_report_bytes()
        out_df, _ = build_transposed(
            data=data,
            asset="THB",
            include_bot=False,
            coins_selected=["XRP"],
        )
        out_bytes = df_to_xlsx_bytes(out_df)
        self.assertTrue(out_bytes.startswith(b"PK"))

        reloaded = pd.read_excel(io.BytesIO(out_bytes), sheet_name="Report")
        self.assertEqual(reloaded.columns.tolist(), out_df.columns.tolist())
        self.assertEqual(reloaded.shape, out_df.shape)
        self.assertEqual(reloaded.iloc[:, 0].astype(str).tolist(), out_df.iloc[:, 0].astype(str).tolist())
        self.assertEqual(
            reloaded.iloc[:, 1].astype(float).round(6).tolist(),
            out_df.iloc[:, 1].astype(float).round(6).tolist(),
        )


if __name__ == "__main__":
    unittest.main()
