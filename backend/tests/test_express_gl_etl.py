from __future__ import annotations

import unittest

from etl_express_gl import clean_express_gl, clean_to_csv_bytes


def make_gl_csv_bytes() -> bytes:
    rows = [
        "100001,,ASSET,,,,,,1000",
        "01/01/2568,,V001,Desc A,,100,20,,1080",
        "200001,,LIAB,,,,,,2000",
        "02/01/2568,,V002,Desc B,,10,50,,2040",
    ]
    return ("\r\n".join(rows)).encode("cp874")


class ExpressGlEtlTests(unittest.TestCase):
    def test_clean_express_gl_keeps_shape_and_value_formula(self) -> None:
        data = make_gl_csv_bytes()
        clean_df, summary, validation, preview = clean_express_gl(data, lang="th")

        self.assertEqual(clean_df.shape[0], 2)
        self.assertEqual(summary["clean_rows"], 2)
        self.assertEqual(validation["error_count"], 0)
        self.assertIn("raw", preview)
        self.assertIn("clean", preview)

        # Row order should be by account/date.
        self.assertEqual(int(clean_df.iloc[0, 0]), 100001)
        self.assertEqual(clean_df.iloc[0, 1], "1/1/2025")
        self.assertAlmostEqual(float(clean_df.iloc[0, -1]), 80.0)

        self.assertEqual(int(clean_df.iloc[1, 0]), 200001)
        self.assertEqual(clean_df.iloc[1, 1], "1/2/2025")
        self.assertAlmostEqual(float(clean_df.iloc[1, -1]), 40.0)

    def test_clean_to_csv_bytes_has_bom_and_value_header(self) -> None:
        data = make_gl_csv_bytes()
        clean_df, _, _, _ = clean_express_gl(data, lang="th")
        csv_bytes = clean_to_csv_bytes(clean_df)

        self.assertEqual(csv_bytes[:3], b"\xef\xbb\xbf")
        text = csv_bytes.decode("utf-8-sig")
        self.assertIn("Value", text.splitlines()[0])


if __name__ == "__main__":
    unittest.main()
