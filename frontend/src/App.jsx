import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDropzone } from "react-dropzone";
import {
  FileDown,
  Sparkles,
  ShieldCheck,
  Star,
  FileSpreadsheet,
  Moon,
  Sun,
  CheckCircle2,
  UploadCloud,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ListChecks, MousePointerClick } from "lucide-react";
import AuthBar from "./components/AuthBar";
import { setAppLanguage } from "./i18n";
import { apiUrl } from "./lib/api";

const IS_DEV = import.meta.env.DEV;
const NUMBER_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function parseFilenameFromDisposition(disposition) {
  if (!disposition) return null;
  const m = /filename="([^"]+)"/.exec(disposition);
  return m ? m[1] : null;
}

function fmtNumber(n) {
  if (n === null || n === undefined) return "-";
  if (typeof n !== "number") return String(n);
  return NUMBER_FORMATTER.format(n);
}

function Spinner({ isDark, label }) {
  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={cn(
          "h-5 w-5 rounded-full border-2 animate-spin",
          isDark
            ? "border-white/30 border-t-white"
            : "border-black/20 border-t-black/80",
        )}
      />
      <span
        className={cn("text-sm", isDark ? "text-white/80" : "text-black/70")}
      >
        {label || "Loading..."}
      </span>
    </div>
  );
}

function FeatureCard({ isDark, title, desc, icon }) {
  return (
    <div
      className={cn(
        "rounded-2xl p-4 shadow-sm transition",
        isDark
          ? "bg-white/5 border border-white/10 hover:bg-white/10"
          : "bg-black/5 border border-black/10 hover:bg-black/10",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          isDark ? "text-white/90" : "text-black/85",
        )}
      >
        <div
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center",
            isDark ? "bg-white/10" : "bg-black/10",
          )}
        >
          {icon}
        </div>
        <div className="font-semibold">{title}</div>
      </div>
      <div
        className={cn(
          "mt-2 text-sm leading-relaxed",
          isDark ? "text-white/70" : "text-black/65",
        )}
      >
        {desc}
      </div>
    </div>
  );
}

function HowItWorks({ isDark, t }) {
  const steps = [
    {
      n: "01",
      title: t("howStep1Title"),
      desc: t("howStep1Desc"),
      icon: (
        <MousePointerClick
          className={cn("h-5 w-5", isDark ? "text-white/85" : "text-black/75")}
        />
      ),
    },
    {
      n: "02",
      title: t("howStep2Title"),
      desc: t("howStep2Desc"),
      icon: (
        <ListChecks
          className={cn("h-5 w-5", isDark ? "text-white/85" : "text-black/75")}
        />
      ),
    },
    {
      n: "03",
      title: t("howStep3Title"),
      desc: t("howStep3Desc"),
      icon: (
        <FileDown
          className={cn("h-5 w-5", isDark ? "text-white/85" : "text-black/75")}
        />
      ),
    },
  ];

  return (
    <div className="mt-10">
      <div
        className={cn(
          "mb-2 text-lg font-semibold",
          isDark ? "text-white/90" : "text-black/85",
        )}
      >
        {t("howTitle")}
      </div>
      <div
        className={cn(
          "mb-4 text-sm",
          isDark ? "text-white/60" : "text-black/60",
        )}
      >
        {t("howSubtitle")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((s) => (
          <div
            key={s.n}
            className={cn(
              "rounded-2xl p-4 border transition relative overflow-hidden",
              isDark
                ? "bg-white/5 border-white/10 hover:bg-white/10"
                : "bg-white/70 border-black/10 hover:bg-white/85",
            )}
          >
            {/* subtle glow */}
            <div
              className={cn(
                "pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full blur-2xl opacity-40",
                isDark ? "bg-white/10" : "bg-black/5",
              )}
            />

            <div className="flex items-center justify-between">
              <div
                className={cn(
                  "text-xs font-semibold tracking-wider",
                  isDark ? "text-white/50" : "text-black/50",
                )}
              >
                STEP {s.n}
              </div>
              <div
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center",
                  isDark ? "bg-white/10" : "bg-black/10",
                )}
              >
                {s.icon}
              </div>
            </div>

            <div
              className={cn(
                "mt-3 font-semibold",
                isDark ? "text-white/90" : "text-black/85",
              )}
            >
              {s.title}
            </div>
            <div
              className={cn(
                "mt-2 text-sm leading-relaxed",
                isDark ? "text-white/70" : "text-black/65",
              )}
            >
              {s.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ isDark, label, value, sub }) {
  return (
    <div
      className={cn(
        "rounded-2xl p-4 border",
        isDark ? "bg-white/5 border-white/10" : "bg-white/70 border-black/10",
      )}
    >
      <div
        className={cn("text-xs", isDark ? "text-white/55" : "text-black/55")}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold",
          isDark ? "text-white/90" : "text-black/85",
        )}
      >
        {value}
      </div>
      {sub ? (
        <div
          className={cn(
            "mt-1 text-xs",
            isDark ? "text-white/50" : "text-black/50",
          )}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function DataTable({ isDark, title, columns, rows }) {
  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden",
        isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-white/70",
      )}
    >
      <div
        className={cn(
          "px-4 py-3 font-semibold",
          isDark ? "text-white/90" : "text-black/85",
        )}
      >
        {title}
      </div>
      <div
        className={cn(
          "overflow-auto max-h-[360px] border-t mini-scroll",
          isDark ? "border-white/10" : "border-black/10",
        )}
      >
        <table className="min-w-full text-sm">
          <thead
            className={cn(
              "sticky top-0 z-10",
              isDark ? "bg-[#0B1730]" : "bg-white",
            )}
          >
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className={cn(
                    "text-left px-3 py-2 whitespace-nowrap text-xs font-semibold",
                    isDark ? "text-white/70" : "text-black/60",
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows?.length ? (
              rows.map((r, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    isDark
                      ? "odd:bg-white/0 even:bg-white/5"
                      : "odd:bg-black/0 even:bg-black/5",
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c}
                      className={cn(
                        "px-3 py-2 whitespace-nowrap",
                        isDark ? "text-white/80" : "text-black/75",
                      )}
                    >
                      {r?.[c] === null || r?.[c] === undefined
                        ? ""
                        : String(r[c])}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns?.length || 1}
                  className={cn(
                    "px-3 py-4 text-sm",
                    isDark ? "text-white/60" : "text-black/55",
                  )}
                >
                  -
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ValidationPanel({
  isDark,
  t,
  validation,
  overrideErrors,
  setOverrideErrors,
}) {
  const [showAllErr, setShowAllErr] = useState(false);
  const [showAllWarn, setShowAllWarn] = useState(false);

  if (!validation) return null;

  const errors = validation.errors || [];
  const warnings = validation.warnings || [];

  const errCount = validation.error_count || 0;
  const warnCount = validation.warning_count || 0;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-white/70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={cn(
              "text-sm font-semibold flex items-center gap-2",
              isDark ? "text-white/90" : "text-black/85",
            )}
          >
            <AlertTriangle
              className={cn(
                "h-4 w-4",
                errCount ? "text-red-400" : "text-emerald-400",
              )}
            />
            {t("validationTitle")}
          </div>
          <div
            className={cn(
              "mt-1 text-xs",
              isDark ? "text-white/60" : "text-black/60",
            )}
          >
            {t("errors")}:{" "}
            <span className={cn(errCount ? "text-red-400 font-semibold" : "")}>
              {errCount}
            </span>{" "}
            • {t("warnings")}:{" "}
            <span
              className={cn(warnCount ? "text-amber-500 font-semibold" : "")}
            >
              {warnCount}
            </span>
          </div>
        </div>

        {errCount > 0 ? (
          <label
            className={cn(
              "text-xs flex items-center gap-2 cursor-pointer select-none",
              isDark ? "text-white/70" : "text-black/70",
            )}
          >
            <input
              type="checkbox"
              className="accent-red-500"
              checked={overrideErrors}
              onChange={(e) => setOverrideErrors(e.target.checked)}
            />
            {t("downloadAnyway")}
          </label>
        ) : null}
      </div>

      {/* Errors */}
      {errCount > 0 ? (
        <div className="mt-3">
          <div
            className={cn(
              "text-xs font-semibold mb-2 flex items-center gap-2",
              "text-red-400",
            )}
          >
            <XCircle className="h-4 w-4" /> {t("errors")}
          </div>

          <ul
            className={cn(
              "space-y-1 text-xs",
              isDark ? "text-white/75" : "text-black/75",
            )}
          >
            {(showAllErr ? errors : errors.slice(0, 6)).map((e, idx) => (
              <li
                key={idx}
                className={cn(
                  "rounded-xl px-3 py-2 border",
                  isDark
                    ? "border-white/10 bg-white/5"
                    : "border-black/10 bg-white/60",
                )}
              >
                <span className="font-semibold">Row {e.row}</span> • {e.field} •{" "}
                {e.message}
              </li>
            ))}
          </ul>

          {errors.length > 6 ? (
            <button
              className={cn(
                "mt-2 text-xs underline",
                isDark ? "text-white/70" : "text-black/70",
              )}
              onClick={() => setShowAllErr((v) => !v)}
              type="button"
            >
              {showAllErr ? t("showLess") : t("showMore")}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Warnings */}
      {warnCount > 0 ? (
        <div className="mt-4">
          <div
            className={cn(
              "text-xs font-semibold mb-2 flex items-center gap-2",
              "text-amber-500",
            )}
          >
            <AlertTriangle className="h-4 w-4" /> {t("warnings")}
          </div>

          <ul
            className={cn(
              "space-y-1 text-xs",
              isDark ? "text-white/75" : "text-black/75",
            )}
          >
            {(showAllWarn ? warnings : warnings.slice(0, 6)).map((w, idx) => (
              <li
                key={idx}
                className={cn(
                  "rounded-xl px-3 py-2 border",
                  isDark
                    ? "border-white/10 bg-white/5"
                    : "border-black/10 bg-white/60",
                )}
              >
                <span className="font-semibold">Row {w.row}</span> • {w.field} •{" "}
                {w.message}
              </li>
            ))}
          </ul>

          {warnings.length > 6 ? (
            <button
              className={cn(
                "mt-2 text-xs underline",
                isDark ? "text-white/70" : "text-black/70",
              )}
              onClick={() => setShowAllWarn((v) => !v)}
              type="button"
            >
              {showAllWarn ? t("showLess") : t("showMore")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Reviews marquee: equal size cards, filled yellow stars, seamless loop */
function ReviewsMarquee({ isDark }) {
  const reviews = useMemo(
    () => [
      {
        name: "Accounting",
        text: "Value คำนวณถูกตามผังบัญชี ลดงานมือได้เยอะ",
        rate: 5,
      },
      {
        name: "Ops",
        text: "UI ใช้งานง่าย ลากไฟล์วางแล้วรู้เลยว่าพร้อมทำงาน",
        rate: 5,
      },
      {
        name: "Audit",
        text: "ตัดแถวรวม/แถวขยะออกให้เรียบร้อย ตรวจง่ายขึ้น",
        rate: 5,
      },
      {
        name: "Finance Team",
        text: "ไฟล์เปิดใน Excel แล้วไม่เพี้ยน แถมกดครั้งเดียวจบ",
        rate: 5,
      },
      {
        name: "Controller",
        text: "รูปแบบไฟล์คงที่ ทำ ETL ต่อได้ทันที",
        rate: 5,
      },
      {
        name: "Data Team",
        text: "โครงสร้างคอลัมน์นิ่ง ใช้ต่อ Power BI ได้ง่าย",
        rate: 5,
      },
    ],
    [],
  );

  const items = [...reviews, ...reviews];

  return (
    <div
      className={cn(
        "marquee-wrap overflow-hidden rounded-2xl border",
        isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5",
      )}
    >
      <div className="marquee-track inline-flex w-max gap-4 px-4 py-4">
        {items.map((r, idx) => (
          <div
            key={idx}
            className={cn(
              "rounded-2xl border transition flex flex-col justify-between",
              "w-[380px] h-[145px] p-4",
              isDark
                ? "bg-white/5 border-white/10 hover:bg-white/10"
                : "bg-white/60 border-black/10 hover:bg-white/80",
            )}
          >
            <div className="flex items-center justify-between gap-10">
              <div
                className={cn(
                  "font-semibold text-base",
                  isDark ? "text-white/90" : "text-black/85",
                )}
              >
                {r.name}
              </div>
              <div className="flex items-center gap-2">
                {Array.from({ length: r.rate }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-[18px] w-[18px] text-amber-400"
                    fill="currentColor"
                  />
                ))}
              </div>
            </div>
            <div
              className={cn(
                "text-sm leading-relaxed",
                isDark ? "text-white/70" : "text-black/65",
              )}
            >
              {r.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const { t, i18n } = useTranslation();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null); // {summary, validation, preview}
  const [overrideErrors, setOverrideErrors] = useState(false);

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch (e) {
      void e;
    }
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  });
  useEffect(() => {
    const isDarkTheme = theme === "dark";
    const rootEl = document.getElementById("root");
    const targets = [document.documentElement, document.body, rootEl].filter(
      Boolean,
    );

    for (const el of targets) {
      el.classList.toggle("dark", isDarkTheme);
      el.classList.toggle("light", !isDarkTheme);
      el.setAttribute("data-theme", theme);
    }

    document.documentElement.style.colorScheme = isDarkTheme ? "dark" : "light";

    try {
      localStorage.setItem("theme", theme);
      localStorage.setItem("vite-ui-theme", theme);
      localStorage.setItem("eglc_theme", theme);
    } catch (e) {
      void e;
    }

    window.dispatchEvent(new Event("eglc-theme-change"));
  }, [theme]);

  const [notice, setNotice] = useState("");
  const previewReqRef = useRef(0);

  const isDark = theme === "dark";

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  const onDrop = useCallback((accepted) => {
    const f = accepted?.[0] || null;
    setFile(f);
    setOverrideErrors(false);
    setPreviewData(null);
    if (f) setNotice(t("dropHintReady"));
  }, [t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "text/csv": [".csv"] },
    multiple: false,
    onDrop,
  });

  // Auto preview when file changes (or language changes)
  useEffect(() => {
    if (!file) {
      setPreviewData(null);
      return;
    }

    const startedAt = IS_DEV ? performance.now() : 0;
    const requestId = previewReqRef.current + 1;
    previewReqRef.current = requestId;
    const ctrl = new AbortController();

    (async () => {
      setPreviewLoading(true);
      try {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch(
          apiUrl(`/api/preview?limit=25&lang=${i18n.language}`),
          {
            method: "POST",
            body: form,
            signal: ctrl.signal,
          },
        );

        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        if (previewReqRef.current !== requestId) return;
        setPreviewData(json);
      } catch (e) {
        if (e?.name !== "AbortError" && !ctrl.signal.aborted) {
          if (IS_DEV) {
            console.info(`[perf][express-preview-error] ${String(e?.message || e)}`);
          }
          if (previewReqRef.current !== requestId) return;
          setPreviewData({
            summary: null,
            validation: {
              error_count: 1,
              warning_count: 0,
              errors: [
                { row: 1, field: "Preview", message: String(e?.message || e) },
              ],
              warnings: [],
            },
            preview: {
              raw: { columns: [], rows: [] },
              clean: { columns: [], rows: [] },
            },
          });
        }
      } finally {
        if (previewReqRef.current === requestId) {
          setPreviewLoading(false);
        }
        if (IS_DEV) {
          const duration = performance.now() - startedAt;
          console.info(
            `[perf][express-preview] ${Math.max(duration, 0).toFixed(1)}ms`,
          );
        }
      }
    })();

    return () => ctrl.abort();
  }, [file, i18n.language]);

  const hasErrors = (previewData?.validation?.error_count || 0) > 0;
  const blockDownload = hasErrors && !overrideErrors;

  async function onClean() {
    if (!file || loading) return;
    if (blockDownload) return;
    const startedAt = IS_DEV ? performance.now() : 0;

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(apiUrl(`/api/clean?lang=${i18n.language}`), {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Clean failed");
      }

      const blob = await res.blob();
      const filename =
        parseFilenameFromDisposition(res.headers.get("content-disposition")) ||
        "CLEAN.csv";

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setNotice("Downloaded ✅");
    } catch (err) {
      alert("Error: " + (err?.message || err));
    } finally {
      setLoading(false);
      if (IS_DEV) {
        const duration = performance.now() - startedAt;
        console.info(
          `[perf][express-clean] ${Math.max(duration, 0).toFixed(1)}ms`,
        );
      }
    }
  }

  function onReset() {
    setFile(null);
    setPreviewData(null);
    setOverrideErrors(false);
    setNotice("");
  }

  const pageBg = isDark ? "text-white" : "text-slate-900";

  const shellCard = isDark
    ? "bg-[#080E1E]/89 border border-white/16 shadow-[0_24px_70px_rgba(2,6,23,0.62)] backdrop-blur-md"
    : "bg-white/70 border border-black/10 shadow-xl backdrop-blur-md";

  const summary = previewData?.summary;
  const validation = previewData?.validation;
  const preview = previewData?.preview;
  const activeLang = (i18n.resolvedLanguage || i18n.language || "en")
    .toLowerCase()
    .startsWith("th")
    ? "th"
    : "en";

  return (
    <div className={cn("min-h-screen", pageBg)}>
      <div className="i18n-swap-layer max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-2xl flex items-center justify-center",
                isDark
                  ? "bg-white/10 border border-white/10"
                  : "bg-black/5 border border-black/10",
              )}
            >
              <FileSpreadsheet
                className={cn(
                  "h-5 w-5",
                  isDark ? "text-white/90" : "text-black/80",
                )}
              />
            </div>

            <div>
              <div className="text-lg font-semibold">{t("title")}</div>
              <div
                className={cn(
                  "text-sm",
                  isDark ? "text-white/60" : "text-black/55",
                )}
              >
                {t("subtitle")}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Lang */}
            <div
              className={cn(
                "rounded-2xl p-1 flex items-center",
                isDark
                  ? "bg-white/5 border border-white/10"
                  : "bg-black/5 border border-black/10",
              )}
            >
              <button
                className={cn(
                  "px-3 py-1.5 rounded-xl text-sm transition",
                  activeLang === "th"
                    ? isDark
                      ? "bg-white/15"
                      : "bg-black/10"
                    : isDark
                      ? "text-white/70 hover:text-white"
                      : "text-black/60 hover:text-black",
                )}
                onClick={() => setAppLanguage("th")}
              >
                TH
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-xl text-sm transition",
                  activeLang === "en"
                    ? isDark
                      ? "bg-white/15"
                      : "bg-black/10"
                    : isDark
                      ? "text-white/70 hover:text-white"
                      : "text-black/60 hover:text-black",
                )}
                onClick={() => setAppLanguage("en")}
              >
                EN
              </button>
            </div>

            {/* Theme */}
            <div
              className={cn(
                "rounded-2xl p-1 flex items-center",
                isDark
                  ? "bg-white/5 border border-white/10"
                  : "bg-black/5 border border-black/10",
              )}
            >
              <button
                className={cn(
                  "px-3 py-1.5 rounded-xl text-sm flex items-center gap-2 transition",
                  isDark ? "bg-white/15" : "text-black/60 hover:text-black",
                )}
                onClick={() => setTheme("dark")}
              >
                <Moon
                  className={cn(
                    "h-4 w-4",
                    isDark ? "text-white/90" : "text-black/70",
                  )}
                />
                {t("dark")}
              </button>

              <button
                className={cn(
                  "px-3 py-1.5 rounded-xl text-sm flex items-center gap-2 transition",
                  !isDark ? "bg-black/10" : "text-white/70 hover:text-white",
                )}
                onClick={() => setTheme("light")}
              >
                <Sun
                  className={cn(
                    "h-4 w-4",
                    !isDark ? "text-black/80" : "text-white/70",
                  )}
                />
                {t("light")}
              </button>
            </div>

            <AuthBar />
          </div>
        </div>

        {/* Main Card */}
        <div className={cn("mt-8 rounded-3xl p-8", shellCard)}>
          <div className="text-2xl font-semibold">{t("headline")}</div>
          <div
            className={cn(
              "mt-2 leading-relaxed",
              isDark ? "text-white/70" : "text-black/65",
            )}
          >
            {t("desc")}
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={cn(
              "mt-6 rounded-2xl border border-dashed p-6 cursor-pointer transition relative",
              isDark
                ? "bg-white/5 border-white/15"
                : "bg-black/5 border-black/15",
              isDragActive &&
                "border-green-400 shadow-[0_0_0_3px_rgba(34,197,94,0.25)]",
              file &&
                !isDragActive &&
                "shadow-[0_0_0_2px_rgba(34,197,94,0.18)]",
            )}
          >
            <input {...getInputProps()} />

            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center border",
                  isDark
                    ? "bg-white/10 border-white/10"
                    : "bg-black/10 border-black/10",
                )}
              >
                {isDragActive ? (
                  <UploadCloud
                    className={cn(
                      "h-6 w-6",
                      isDark ? "text-green-300" : "text-green-700",
                    )}
                  />
                ) : (
                  <FileDown
                    className={cn(
                      "h-6 w-6",
                      isDark ? "text-white/90" : "text-black/75",
                    )}
                  />
                )}
              </div>

              <div className="flex-1">
                <div
                  className={cn(
                    "font-semibold",
                    isDark ? "text-white/90" : "text-black/85",
                  )}
                >
                  {t("drop")}
                </div>
                <div
                  className={cn(
                    "text-sm",
                    isDark ? "text-white/60" : "text-black/55",
                  )}
                >
                  {t("dropSub")}
                </div>
              </div>

              {/* Status chip */}
              <div
                className={cn(
                  "shrink-0 rounded-xl px-3 py-2 text-xs border flex items-center gap-2",
                  isDragActive
                    ? "border-green-400/60 bg-green-500/10"
                    : file
                      ? "border-green-400/50 bg-green-500/10"
                      : isDark
                        ? "border-white/10 bg-white/5"
                        : "border-black/10 bg-black/5",
                )}
              >
                {isDragActive ? (
                  <>
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isDark ? "bg-green-300" : "bg-green-700",
                      )}
                    />
                    <span
                      className={cn(
                        isDark ? "text-green-200" : "text-green-800",
                      )}
                    >
                      {t("dropHintDragging")}
                    </span>
                  </>
                ) : file ? (
                  <>
                    <CheckCircle2
                      className={cn(
                        "h-4 w-4",
                        isDark ? "text-green-300" : "text-green-700",
                      )}
                    />
                    <span
                      className={cn(
                        isDark ? "text-green-200" : "text-green-800",
                      )}
                    >
                      {t("dropHintReady")}
                    </span>
                  </>
                ) : (
                  <>
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isDark ? "bg-white/40" : "bg-black/30",
                      )}
                    />
                    <span
                      className={cn(isDark ? "text-white/60" : "text-black/55")}
                    >
                      {t("dropHintIdle")}
                    </span>
                  </>
                )}
              </div>
            </div>

            {notice ? (
              <div
                className={cn(
                  "absolute -bottom-3 left-6 rounded-xl px-3 py-1 text-xs border backdrop-blur-md",
                  isDark
                    ? "bg-white/10 border-white/15 text-white/80"
                    : "bg-white/80 border-black/10 text-black/70",
                )}
              >
                {notice}
              </div>
            ) : null}
          </div>

          {/* Selected file (with frame) */}
          <div
            className={cn(
              "mt-4 text-sm flex items-center gap-2",
              isDark ? "text-white/70" : "text-black/65",
            )}
          >
            <span className={cn(isDark ? "text-white/60" : "text-black/55")}>
              {t("selected")}:
            </span>

            <span
              className={cn(
                "px-3 py-1 rounded-xl border text-sm font-medium",
                "max-w-[520px] truncate",
                file
                  ? isDark
                    ? "border-white/15 bg-white/10 text-white/90"
                    : "border-black/15 bg-white/80 text-black/85"
                  : isDark
                    ? "border-white/10 bg-white/5 text-white/60"
                    : "border-black/10 bg-black/5 text-black/55",
              )}
              title={file ? file.name : ""}
            >
              {file ? file.name : "-"}
            </span>
          </div>

          <div
            className={cn(
              "mt-2 text-xs",
              isDark ? "text-white/50" : "text-black/45",
            )}
          >
            {t("tip")}
          </div>

          {/* Preview / Validation / Summary */}
          {file ? (
            <div className="mt-8 space-y-4">
              <div
                className={cn(
                  "text-lg font-semibold",
                  isDark ? "text-white/90" : "text-black/85",
                )}
              >
                {t("previewTitle")}
              </div>

              {previewLoading ? (
                <div
                  className={cn(
                    "rounded-2xl border p-4",
                    isDark
                      ? "border-white/10 bg-white/5"
                      : "border-black/10 bg-white/70",
                  )}
                >
                  <Spinner isDark={isDark} label={t("loadingPreview")} />
                </div>
              ) : (
                <>
                  <ValidationPanel
                    isDark={isDark}
                    t={t}
                    validation={validation}
                    overrideErrors={overrideErrors}
                    setOverrideErrors={setOverrideErrors}
                  />

                  {summary ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <StatCard
                        isDark={isDark}
                        label="Rows (raw lines)"
                        value={fmtNumber(summary.total_lines)}
                      />
                      <StatCard
                        isDark={isDark}
                        label="Rows (clean)"
                        value={fmtNumber(summary.clean_rows)}
                      />
                      <StatCard
                        isDark={isDark}
                        label="Unique Accounts"
                        value={fmtNumber(summary.unique_accounts)}
                      />
                      <StatCard
                        isDark={isDark}
                        label="Date Range"
                        value={
                          summary.date_min && summary.date_max
                            ? `${summary.date_min} → ${summary.date_max}`
                            : "-"
                        }
                      />
                      <StatCard
                        isDark={isDark}
                        label="Sum Debit"
                        value={fmtNumber(summary.sum_debit)}
                      />
                      <StatCard
                        isDark={isDark}
                        label="Sum Credit"
                        value={fmtNumber(summary.sum_credit)}
                      />
                      <StatCard
                        isDark={isDark}
                        label="Sum Value"
                        value={fmtNumber(summary.sum_value)}
                      />
                      <StatCard
                        isDark={isDark}
                        label="Txn Candidates"
                        value={fmtNumber(summary.txn_candidate_rows)}
                        sub={`Headers: ${fmtNumber(summary.account_headers)}`}
                      />
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <DataTable
                      isDark={isDark}
                      title={t("rawPreviewTitle")}
                      columns={preview?.raw?.columns || []}
                      rows={preview?.raw?.rows || []}
                    />
                    <DataTable
                      isDark={isDark}
                      title={t("cleanPreviewTitle")}
                      columns={preview?.clean?.columns || []}
                      rows={preview?.clean?.rows || []}
                    />
                  </div>
                </>
              )}
            </div>
          ) : null}

          {/* Buttons */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={onClean}
              disabled={!file || loading || blockDownload}
              className={cn(
                "px-5 py-3 rounded-2xl font-semibold transition border duration-200",
                isDark ? "border-white/10" : "border-black/10",
                isDark ? "bg-white/10" : "bg-white/70",
                (!file || loading) && "opacity-50 cursor-not-allowed",
                blockDownload && "opacity-50 cursor-not-allowed",
                // drag green state
                isDragActive &&
                  !loading &&
                  (isDark
                    ? "bg-green-500/20 hover:bg-green-500/25 border-green-400/70"
                    : "bg-green-500/15 hover:bg-green-500/20 border-green-500/60") +
                    " shadow-[0_0_0_4px_rgba(34,197,94,0.28)]",
                // file ready: hover becomes green
                file &&
                  !isDragActive &&
                  !loading &&
                  (isDark
                    ? "hover:bg-green-500/18 border-green-400/60"
                    : "hover:bg-green-500/14 border-green-500/55") +
                    " shadow-[0_0_0_3px_rgba(34,197,94,0.20)]",
                !file &&
                  !isDragActive &&
                  (isDark ? "hover:bg-white/15" : "hover:bg-white/90"),
              )}
              title={blockDownload ? t("blockedByErrors") : ""}
            >
              {loading ? (
                <Spinner isDark={isDark} label="Cleaning..." />
              ) : (
                t("clean")
              )}
            </button>

            <button
              onClick={onReset}
              className={cn(
                "px-5 py-3 rounded-2xl font-semibold transition border duration-200",
                isDark
                  ? "bg-white/5 border-white/10"
                  : "bg-black/5 border-black/10",
                isDark
                  ? "hover:bg-red-500/20 hover:border-red-400/70 hover:shadow-[0_0_0_4px_rgba(239,68,68,0.22)]"
                  : "hover:bg-red-500/15 hover:border-red-500/60 hover:shadow-[0_0_0_4px_rgba(239,68,68,0.18)]",
              )}
            >
              {t("reset")}
            </button>
          </div>

          {/* How it works */}
          <HowItWorks isDark={isDark} t={t} />

          {/* Features */}
          <div className="mt-10">
            <div
              className={cn(
                "mb-3 text-lg font-semibold",
                isDark ? "text-white/90" : "text-black/85",
              )}
            >
              {t("featuresTitle")}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FeatureCard
                isDark={isDark}
                title={t("features1")}
                desc={t("features1d")}
                icon={
                  <Sparkles
                    className={cn(
                      "h-5 w-5",
                      isDark ? "text-white/85" : "text-black/75",
                    )}
                  />
                }
              />
              <FeatureCard
                isDark={isDark}
                title={t("features2")}
                desc={t("features2d")}
                icon={
                  <ShieldCheck
                    className={cn(
                      "h-5 w-5",
                      isDark ? "text-white/85" : "text-black/75",
                    )}
                  />
                }
              />
              <FeatureCard
                isDark={isDark}
                title={t("features3")}
                desc={t("features3d")}
                icon={
                  <FileDown
                    className={cn(
                      "h-5 w-5",
                      isDark ? "text-white/85" : "text-black/75",
                    )}
                  />
                }
              />
            </div>
          </div>

          {/* Reviews */}
          <div className="mt-10">
            <div
              className={cn(
                "mb-3 text-lg font-semibold",
                isDark ? "text-white/90" : "text-black/85",
              )}
            >
              {t("reviewsTitle")}
            </div>
            <ReviewsMarquee isDark={isDark} />
          </div>
        </div>

        <div
          className={cn(
            "mt-6 text-xs",
            isDark ? "text-white/40" : "text-black/45",
          )}
        >
          Made for internal use • FastAPI • Modern React UI
        </div>
      </div>
    </div>
  );
}
