import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { setAppLanguage } from "../i18n";
import {
  Search,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  Download,
  RotateCcw,
  Check,
  ChevronDown,
  Sun,
  Moon,
} from "lucide-react";
import AuthBar from "../components/AuthBar";

const cn = (...xs) => xs.filter(Boolean).join(" ");
const IS_DEV = import.meta.env.DEV;
const EMPTY_PREVIEW = { headers: [], rows: [] };
const RP_WATCHLISTS_KEY = "rp_watchlists_v1";
const RP_WATCHLIST_ONLY_KEY = "rp_watchlist_only_v1";

function areSameStringArray(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (String(a[i]) !== String(b[i])) return false;
  }
  return true;
}

function normalizeCoinList(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const coin = String(item || "").trim();
    if (!coin) continue;
    const key = coin.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(coin);
  }

  return out;
}

function parseStoredWatchlists() {
  try {
    const raw = localStorage.getItem(RP_WATCHLISTS_KEY);
    if (!raw) return { USD: [], THB: [] };
    const parsed = JSON.parse(raw);
    return {
      USD: normalizeCoinList(parsed?.USD),
      THB: normalizeCoinList(parsed?.THB),
    };
  } catch (e) {
    void e;
    return { USD: [], THB: [] };
  }
}

function detectWatchlistFromLatest(assetCoins, usdCoins, thbCoins) {
  const available = normalizeCoinList(assetCoins);
  if (!available.length) return [];

  const usdSet = new Set(normalizeCoinList(usdCoins).map((c) => c.toLowerCase()));
  const thbSet = new Set(normalizeCoinList(thbCoins).map((c) => c.toLowerCase()));

  const overlap = available.filter((coin) => {
    const key = coin.toLowerCase();
    return usdSet.has(key) && thbSet.has(key);
  });

  if (overlap.length) return overlap;
  return available.slice(0, Math.min(available.length, 12));
}

function reconcileWatchlist(prevWatchlist, assetCoins, usdCoins, thbCoins) {
  const available = normalizeCoinList(assetCoins);
  if (!available.length) return [];

  const byKey = new Map(available.map((coin) => [coin.toLowerCase(), coin]));
  const kept = normalizeCoinList(prevWatchlist)
    .map((coin) => byKey.get(coin.toLowerCase()))
    .filter(Boolean);

  if (kept.length) return kept;
  return detectWatchlistFromLatest(available, usdCoins, thbCoins);
}

/** ===== Theme sync ( ETL ) ===== */
const THEME_KEYS = ["theme", "vite-ui-theme", "eglc_theme"];
const THEME_EVENT = "eglc-theme-change";

function themeTargets() {
  const els = [document.documentElement, document.body];

  const root = document.getElementById("root");
  if (root) {
    els.push(root);

    // wrapper  React tree (AppProviders/Root layout)
    if (root.firstElementChild) els.push(root.firstElementChild);
  }

  return Array.from(new Set(els.filter(Boolean)));
}


function readTheme() {
  try {
    // 1) data-theme html/body/root
    for (const el of themeTargets()) {
      const v = el.getAttribute("data-theme");
      if (v === "dark" || v === "light") return v;
    }

    // 2) localStorage keys
    for (const k of THEME_KEYS) {
      const v = localStorage.getItem(k);
      if (v === "dark" || v === "light") return v;
    }
  } catch (e) {
    void e;
  }

  // 3) classList (html/body/root)
  const anyDark = themeTargets().some((el) => el.classList.contains("dark"));
  if (anyDark) return "dark";

  // 4) system fallback
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function writeTheme(mode) {
  const isDark = mode === "dark";

  // html/body/root
  for (const el of themeTargets()) {
    el.classList.toggle("dark", isDark);
    el.classList.toggle("light", !isDark);
    el.setAttribute("data-theme", mode);
  }

  // native UI/scrollbar 
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";

  try {
    for (const k of THEME_KEYS) localStorage.setItem(k, mode);
  } catch (e) {
    void e;
  }

  window.dispatchEvent(new Event(THEME_EVENT));
}

function ModeToggle() {
  const { t } = useTranslation();
  const [mode, setMode] = useState(readTheme);

  // Sync initial theme with DOM/localStorage
  useEffect(() => {
    writeTheme(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Listen for theme changes from external sources
  useEffect(() => {
    const onSync = () => {
      const next = readTheme();
      setMode((prev) => (prev === next ? prev : next));
    };
    window.addEventListener(THEME_EVENT, onSync);
    window.addEventListener("storage", onSync);
    return () => {
      window.removeEventListener(THEME_EVENT, onSync);
      window.removeEventListener("storage", onSync);
    };
  }, []);

  useEffect(() => {
  const els = themeTargets();
  const obs = new MutationObserver(() => {
    const next = readTheme();
    setMode((prev) => (prev === next ? prev : next));
  });

  for (const el of els) {
    obs.observe(el, { attributes: true, attributeFilter: ["class", "data-theme"] });
  }

  return () => obs.disconnect();
}, []);


  const set = (next) => {
    setMode(next);
    writeTheme(next);
  };

  const base =
    "rounded-2xl p-1 flex items-center " +
    "bg-black/5 border border-black/10 " +
    "dark:bg-white/5 dark:border-white/10";

  const btnBase =
    "px-3 py-1.5 rounded-xl text-sm flex items-center gap-2 " +
    "transition-colors duration-200";

  return (
    <div className={base}>
      <button
        type="button"
        onClick={() => set("dark")}
        className={cn(
          btnBase,
          mode === "dark"
            ? "bg-black/10 text-black/85 dark:bg-white/15 dark:text-white/90"
            : "text-black/60 hover:text-black dark:text-white/70 dark:hover:text-white"
        )}
      >
        <Moon className="h-4 w-4 text-black/70 dark:text-white/90" />
        {t("dark")}
      </button>

      <button
        type="button"
        onClick={() => set("light")}
        className={cn(
          btnBase,
          mode === "light"
            ? "bg-black/10 text-black/85 dark:bg-white/15 dark:text-white/90"
            : "text-black/60 hover:text-black dark:text-white/70 dark:hover:text-white"
        )}
      >
        <Sun className="h-4 w-4 text-black/75 dark:text-white/70" />
        {t("light")}
      </button>
    </div>
  );
}


function LangToggle() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "th").toLowerCase().startsWith("en") ? "en" : "th";

  const base =
    "rounded-2xl p-1 flex items-center " +
    "bg-black/5 border border-black/10 " +
    "dark:bg-white/5 dark:border-white/10";

  const btnBase =
    "px-3 py-1.5 rounded-xl text-sm transition-colors duration-200";

  return (
    <div className={base}>
      <button
        type="button"
        onClick={() => setAppLanguage("th")}
        className={cn(
          btnBase,
          lang === "th"
            ? "bg-black/10 text-black/85 dark:bg-white/15 dark:text-white/90"
            : "text-black/60 hover:text-black dark:text-white/70 dark:hover:text-white"
        )}
      >
        TH
      </button>
      <button
        type="button"
        onClick={() => setAppLanguage("en")}
        className={cn(
          btnBase,
          lang === "en"
            ? "bg-black/10 text-black/85 dark:bg-white/15 dark:text-white/90"
            : "text-black/60 hover:text-black dark:text-white/70 dark:hover:text-white"
        )}
      >
        EN
      </button>
    </div>
  );
}

/** ===== UI helpers ===== */
const UI = {
  page:
    "min-h-screen " +
    "bg-gradient-to-b from-rose-50 via-white to-amber-50 text-slate-900 " +
    "dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-white",
  muted: "text-slate-600 dark:text-white/60",
  muted2: "text-slate-700 dark:text-white/70",
  panel:
    "rounded-3xl border p-5 " +
    "border-slate-200/70 bg-white/70 " +
    "dark:border-white/10 dark:bg-[#080E1E]/89",
  panel2:
    "rounded-2xl border " +
    "border-slate-200/70 bg-white/70 " +
    "dark:border-white/10 dark:bg-[#080E1E]/89",
  chip:
    "inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-xs " +
    "border-slate-200/70 bg-white/70 text-slate-700 " +
    "dark:border-white/10 dark:bg-[#080E1E]/89 dark:text-white/70",
};

function DataTable({ title, headers, rows }) {
  return (
    <div className={cn("mt-6 overflow-hidden", UI.panel2)}>
      <div className="px-4 py-3 font-semibold">{title}</div>
      <div className="overflow-auto max-h-[380px]">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-950/60">
            <tr>
              {headers?.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    "text-left px-3 py-2 whitespace-nowrap border-b",
                    "border-slate-200/70 text-slate-600",
                    "dark:border-white/10 dark:text-white/70"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows?.map((r, ri) => (
              <tr key={ri} className="hover:bg-black/5 dark:hover:bg-white/5">
                {r.map((c, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      "px-3 py-2 whitespace-nowrap border-b",
                      "border-slate-200/70 text-slate-800",
                      "dark:border-white/10 dark:text-white/80"
                    )}
                  >
                    {c === null || c === undefined ? "" : String(c)}
                  </td>
                ))}
              </tr>
            ))}
            {!rows?.length && (
              <tr>
                <td colSpan={headers?.length || 1} className={cn("px-4 py-6", UI.muted)}>
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatBox({ label, value, tone = "neutral" }) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
      : tone === "blue"
      ? "border-sky-400/25 bg-sky-500/10 text-sky-900 dark:text-sky-100"
      : tone === "amber"
      ? "border-amber-400/25 bg-amber-500/10 text-amber-900 dark:text-amber-100"
      : "border-slate-200/70 bg-white/70 text-slate-900 dark:border-white/10 dark:bg-[#080E1E]/89 dark:text-white";

  return (
    <div className={cn("rounded-2xl border px-4 py-3", toneCls)}>
      <div className="text-xs opacity-75">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function HowStepCard({ step, title, desc, icon }) {
  return (
    <div className={cn(
      "rounded-2xl border p-4",
      "border-slate-200/70 bg-white/70",
      "dark:border-white/10 dark:bg-[#080E1E]/89"
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className={cn("text-xs font-semibold tracking-wider", UI.muted)}>{`STEP ${step}`}</div>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-black/5 dark:bg-white/10">
          {icon}
        </div>
      </div>
      <div className="mt-3 font-semibold">{title}</div>
      <div className={cn("mt-2 text-sm leading-relaxed", UI.muted)}>{desc}</div>
    </div>
  );
}

export default function ReportPrice() {
  const { t } = useTranslation();

  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const [asset, setAsset] = useState("USD");
  const [includeBot, setIncludeBot] = useState(true);

  const [coinsUSD, setCoinsUSD] = useState([]);
  const [coinsTHB, setCoinsTHB] = useState([]);
  const availableCoins = asset === "USD" ? coinsUSD : coinsTHB;
  const [watchlists, setWatchlists] = useState(parseStoredWatchlists);
  const [watchlistOnly, setWatchlistOnly] = useState(() => {
    try {
      return localStorage.getItem(RP_WATCHLIST_ONLY_KEY) === "1";
    } catch (e) {
      void e;
      return false;
    }
  });

  const [selected, setSelected] = useState(() => new Set());
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [rawPreview, setRawPreview] = useState(EMPTY_PREVIEW);
  const [cleanPreview, setCleanPreview] = useState(EMPTY_PREVIEW);
  const [meta, setMeta] = useState(null);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const abortRef = useRef(null);
  const fileInputRef = useRef(null);
  const previewReqRef = useRef(0);
  const prevPreviewConfigRef = useRef({
    file: null,
    asset: "USD",
    includeBot: true,
  });

  const selectedCount = selected.size;
  const watchlistCoins = useMemo(
    () => normalizeCoinList(watchlists?.[asset]),
    [asset, watchlists],
  );
  const watchlistKeySet = useMemo(
    () => new Set(watchlistCoins.map((coin) => coin.toLowerCase())),
    [watchlistCoins],
  );

  useEffect(() => {
    try {
      localStorage.setItem(RP_WATCHLISTS_KEY, JSON.stringify(watchlists));
    } catch (e) {
      void e;
    }
  }, [watchlists]);

  useEffect(() => {
    try {
      localStorage.setItem(RP_WATCHLIST_ONLY_KEY, watchlistOnly ? "1" : "0");
    } catch (e) {
      void e;
    }
  }, [watchlistOnly]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 140);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const orderedSelectedCoins = useMemo(() => {
    if (selected.size === 0 || availableCoins.length === 0) return [];

    const availableByKey = new Map(
      availableCoins.map((coin) => [String(coin).toLowerCase(), String(coin)]),
    );
    const ordered = [];

    for (const coin of selected) {
      const hit = availableByKey.get(String(coin).toLowerCase());
      if (hit) ordered.push(hit);
    }

    return ordered;
  }, [availableCoins, selected]);

  const filteredCoins = useMemo(() => {
    const source = watchlistOnly
      ? availableCoins.filter((coin) =>
          watchlistKeySet.has(String(coin).toLowerCase()),
        )
      : availableCoins;

    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter((c) => String(c).toLowerCase().includes(q));
  }, [availableCoins, search, watchlistKeySet, watchlistOnly]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return filteredCoins.slice(0, 10);
  }, [filteredCoins, search]);

  const resetSelectionOnly = useCallback(() => {
    setSelected(new Set());
    setSearchInput("");
    setSearch("");
    setDropdownOpen(false);
  }, []);

  const setFileFromInput = useCallback((f) => {
    setFile(f || null);
    setErrorMsg("");
    setMeta(null);
    setCoinsUSD([]);
    setCoinsTHB([]);
    setRawPreview(EMPTY_PREVIEW);
    setCleanPreview(EMPTY_PREVIEW);
    resetSelectionOnly();
  }, [resetSelectionOnly]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const toggleCoin = useCallback((c) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = String(c);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const scope = watchlistOnly
      ? availableCoins.filter((coin) =>
          watchlistKeySet.has(String(coin).toLowerCase()),
        )
      : availableCoins;

    setSelected(() => new Set(scope.map(String)));
  }, [availableCoins, watchlistKeySet, watchlistOnly]);

  const clearAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const callPreview = useCallback(async (currentFile, opts, options = {}) => {
    if (!currentFile) return;
    const { showLoader = true } = options;
    const startedAt = IS_DEV ? performance.now() : 0;
    const requestId = previewReqRef.current + 1;
    previewReqRef.current = requestId;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (showLoader) {
      setLoadingPreview(true);
    }
    setErrorMsg("");

    try {
      const fd = new FormData();
      fd.append("file", currentFile);
      fd.append("asset", opts.asset);
      fd.append("include_bot", String(opts.includeBot));
      fd.append("coins", (opts.coins || []).join(","));
      fd.append("limit_rows", "12");
      fd.append("limit_cols", "12");

      const res = await fetch("/api/report/preview", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.detail || `HTTP ${res.status}`);

      if (previewReqRef.current !== requestId) return;
      setMeta(payload.meta || null);
      setCoinsUSD((prev) => {
        const next = payload.coins?.USD || [];
        return areSameStringArray(prev, next) ? prev : next;
      });
      setCoinsTHB((prev) => {
        const next = payload.coins?.THB || [];
        return areSameStringArray(prev, next) ? prev : next;
      });
      setRawPreview(payload.rawPreview || EMPTY_PREVIEW);
      setCleanPreview(payload.cleanPreview || EMPTY_PREVIEW);
    } catch (e) {
      if (e.name === "AbortError" || controller.signal.aborted) return;
      if (previewReqRef.current !== requestId) return;
      setErrorMsg(String(e.message || e));
    } finally {
      if (previewReqRef.current === requestId) {
        setLoadingPreview(false);
      }
      if (IS_DEV) {
        const duration = performance.now() - startedAt;
        console.info(
          `[perf][report-preview] ${Math.max(duration, 0).toFixed(1)}ms`,
        );
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!file) return;
    if (coinsUSD.length === 0 && coinsTHB.length === 0) return;

    setWatchlists((prev) => {
      const nextUSD = reconcileWatchlist(prev?.USD, coinsUSD, coinsUSD, coinsTHB);
      const nextTHB = reconcileWatchlist(prev?.THB, coinsTHB, coinsUSD, coinsTHB);

      if (
        areSameStringArray(prev?.USD || [], nextUSD) &&
        areSameStringArray(prev?.THB || [], nextTHB)
      ) {
        return prev;
      }

      return { USD: nextUSD, THB: nextTHB };
    });
  }, [coinsTHB, coinsUSD, file]);

  useEffect(() => {
    if (!file) {
      prevPreviewConfigRef.current = {
        file: null,
        asset,
        includeBot,
      };
      return;
    }
    const prevCfg = prevPreviewConfigRef.current;
    const isBlockingPreview =
      prevCfg.file !== file ||
      prevCfg.asset !== asset ||
      prevCfg.includeBot !== includeBot;
    prevPreviewConfigRef.current = { file, asset, includeBot };

    const delay = isBlockingPreview ? 0 : 260;
    const tmr = setTimeout(() => {
      const selectedCoins =
        selected.size === 0 ? [] : orderedSelectedCoins;
      callPreview(
        file,
        { asset, includeBot, coins: selectedCoins },
        { showLoader: isBlockingPreview },
      );
    }, delay);
    return () => clearTimeout(tmr);
  }, [asset, callPreview, file, includeBot, orderedSelectedCoins, selected]);

  const handleDownload = useCallback(async () => {
    if (!file || selected.size === 0) return;
    const startedAt = IS_DEV ? performance.now() : 0;

    setLoadingDownload(true);
    setErrorMsg("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("asset", asset);
      fd.append("include_bot", String(includeBot));
      fd.append("coins", orderedSelectedCoins.join(","));

      const res = await fetch("/api/report/clean", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const dispo = res.headers.get("content-disposition") || "";
      const m = dispo.match(/filename="([^"]+)"/);
      const filename = m ? m[1] : "REPORT_CLEAN.xlsx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErrorMsg(String(e.message || e));
    } finally {
      setLoadingDownload(false);
      if (IS_DEV) {
        const duration = performance.now() - startedAt;
        console.info(
          `[perf][report-clean] ${Math.max(duration, 0).toFixed(1)}ms`,
        );
      }
    }
  }, [asset, file, includeBot, orderedSelectedCoins, selected.size]);

  const resetAll = useCallback(() => {
    prevPreviewConfigRef.current = {
      file: null,
      asset: "USD",
      includeBot: true,
    };
    setFile(null);
    setDragOver(false);
    setAsset("USD");
    setIncludeBot(true);
    setCoinsUSD([]);
    setCoinsTHB([]);
    resetSelectionOnly();
    setRawPreview(EMPTY_PREVIEW);
    setCleanPreview(EMPTY_PREVIEW);
    setMeta(null);
    setErrorMsg("");
  }, [resetSelectionOnly]);

  const totalCoinsDetected = meta?.total_coins ?? availableCoins.length ?? 0;
  const previewRows = meta?.rows ?? "-";
  const missingCoins = meta?.missing_coins || [];

  const dropHint = dragOver
    ? t("dropHintDragging")
    : file
    ? t("dropHintReady")
    : t("rpDropHintIdle");

  const howSteps = useMemo(
    () => [
      {
        step: "01",
        title: t("rpHowStep1Title"),
        desc: t("rpHowStep1Desc"),
        icon: <FileSpreadsheet className="h-5 w-5 opacity-80" />,
      },
      {
        step: "02",
        title: t("rpHowStep2Title"),
        desc: t("rpHowStep2Desc"),
        icon: <Search className="h-5 w-5 opacity-80" />,
      },
      {
        step: "03",
        title: t("rpHowStep3Title"),
        desc: t("rpHowStep3Desc"),
        icon: <Download className="h-5 w-5 opacity-80" />,
      },
    ],
    [t],
  );

  return (
    <div className="min-h-screen text-slate-900 dark:text-white">
      <div className="i18n-swap-layer max-w-5xl mx-auto px-4 pb-16">
        {/* Header */}
        <div className="pt-10 flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-semibold">{`${t("rpTitle")} ${t("rpSubtitle")}`}</div>
            <div className={cn("mt-1 text-sm", UI.muted)}>{t("rpSteps")}</div>
          </div>

          <div className="flex items-center gap-3">
            <LangToggle />
            <ModeToggle />
            <AuthBar />
          </div>
        </div>

        {/* Controls */}
        <div className={cn("mt-5", UI.panel)}>
          <div className="flex flex-wrap gap-3 items-center">
            <div className={cn("text-sm", UI.muted2)}>{t("asset")}:</div>

            <div className={cn(
              "rounded-2xl p-1 flex items-center",
              "bg-black/5 border border-black/10",
              "dark:bg-white/5 dark:border-white/10"
            )}>
              <button
                onClick={() => { setAsset("USD"); resetSelectionOnly(); }}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-sm transition-colors duration-200",
                  asset === "USD"
                    ? "bg-black/10 text-black/85 dark:bg-white/15 dark:text-white/90"
                    : "text-black/60 hover:text-black dark:text-white/70 dark:hover:text-white"
                )}
                type="button"
              >
                {t("usd")}
              </button>
              <button
                onClick={() => { setAsset("THB"); resetSelectionOnly(); }}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-sm transition-colors duration-200",
                  asset === "THB"
                    ? "bg-black/10 text-black/85 dark:bg-white/15 dark:text-white/90"
                    : "text-black/60 hover:text-black dark:text-white/70 dark:hover:text-white"
                )}
                type="button"
              >
                {t("thb")}
              </button>
            </div>

            <div className={cn("ml-2 text-sm", UI.muted2)}>{t("botRate")}</div>

            <button
              onClick={() => setIncludeBot((v) => !v)}
              className={cn(
                "relative inline-flex h-7 w-12 items-center rounded-full border transition-colors",
                includeBot
                  ? "bg-emerald-500/35 border-emerald-500/35"
                  : "bg-black/5 border-slate-200/70 dark:bg-white/10 dark:border-white/15"
              )}
              type="button"
              aria-pressed={includeBot}
            >
              <span
                className={cn(
                  "pointer-events-none absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-transform duration-200 ease-out",
                  includeBot
                    ? "translate-x-5 bg-emerald-200"
                    : "translate-x-0 bg-slate-700/40 dark:bg-white/60"
                )}
              />
            </button>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setFileFromInput(f);
            }}
            onClick={openFilePicker}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openFilePicker();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={t("chooseFile")}
            className={cn(
              "mt-4 rounded-2xl border p-4 flex items-center gap-4 transition cursor-pointer",
              "border-slate-200/70 bg-white/60 dark:border-white/10 dark:bg-[#080E1E]/89",
              dragOver && "ring-2 ring-emerald-400/60 shadow-[0_0_25px_rgba(52,211,153,0.25)]",
              file && !dragOver && "shadow-[0_0_25px_rgba(52,211,153,0.12)]"
            )}
          >
            <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-black/5 dark:bg-white/10">
              {dragOver ? (
                <UploadCloud className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              ) : file ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              ) : (
                <FileSpreadsheet className="h-5 w-5 opacity-80" />
              )}
            </div>

            <div className="flex-1">
              <div className="font-semibold">{t("dropXlsx")}</div>
              <div className={cn("text-sm mt-1", UI.muted)}>{t("dropXlsxSub")}</div>

              {file && (
                <div className={cn("mt-2", UI.chip)}>
                  <span>{t("selected")}:</span>
                  <span className="font-semibold">{file.name}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className={cn("text-xs rounded-xl border px-3 py-1.5 flex items-center gap-2",
                dragOver
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                  : file
                    ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                    : "border-slate-200/70 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-[#080E1E]/89 dark:text-white/70"
              )}>
                {dragOver ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-300" />
                    <span>{dropHint}</span>
                  </>
                ) : file ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    <span>{dropHint}</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-white/40" />
                    <span>{dropHint}</span>
                  </>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => setFileFromInput(e.target.files?.[0])}
            />
          </div>

          {/* Buttons */}
          <div className="mt-4 flex flex-wrap gap-3 items-center">
            <button
              onClick={handleDownload}
              disabled={!file || selected.size === 0 || loadingDownload}
              className={cn(
                "px-5 py-2.5 rounded-2xl border font-semibold text-sm transition flex items-center gap-2",
                !file || selected.size === 0 || loadingDownload
                  ? "bg-black/5 border-slate-200/70 text-slate-400 dark:bg-[#080E1E]/89 dark:border-white/10 dark:text-white/40"
                  : "bg-emerald-500/15 border-emerald-400/30 text-emerald-900 hover:bg-emerald-500/20 hover:shadow-[0_0_25px_rgba(52,211,153,0.22)] dark:text-emerald-100"
              )}
              type="button"
            >
              <Download className="h-4 w-4" />
              {loadingDownload ? "Downloading..." : t("clean")}
            </button>

            <button
              onClick={resetAll}
              className={cn(
                "px-5 py-2.5 rounded-2xl border font-semibold text-sm transition flex items-center gap-2",
                "bg-black/5 border-slate-200/70 text-slate-800 hover:bg-rose-500/10 hover:border-rose-400/30 hover:shadow-[0_0_25px_rgba(244,63,94,0.20)]",
                "dark:bg-[#080E1E]/89 dark:border-white/10 dark:text-white/75"
              )}
              type="button"
            >
              <RotateCcw className="h-4 w-4" />
              {t("reset")}
            </button>

            <div className={cn("text-xs", UI.muted)}>* {t("rpSelectBeforeDownload")}</div>
          </div>

          {/* Summary boxes */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatBox label={t("asset")} value={asset} tone="blue" />
            <StatBox label={t("detected")} value={totalCoinsDetected} tone="emerald" />
            <StatBox label={t("selectedCount")} value={`${selectedCount}/${availableCoins.length}`} tone="emerald" />
            <StatBox label={t("botRate")} value={includeBot ? "ON" : "OFF"} tone="amber" />
            <StatBox label={t("rows")} value={previewRows} />
          </div>

          {missingCoins.length > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm">
              <div className="font-semibold">{t("missingCoins")}</div>
              <div className="mt-1 text-xs opacity-90">
                {missingCoins.slice(0, 12).join(", ")}
                {missingCoins.length > 12 ? " ..." : ""}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm">
              <div className="font-semibold">Error</div>
              <div className="mt-1 text-xs opacity-90">{errorMsg}</div>
            </div>
          )}

          {loadingPreview && (
            <div className={cn("mt-3 rounded-2xl border px-4 py-3 text-sm",
              "border-slate-200/70 bg-white/70 text-slate-700",
              "dark:border-white/10 dark:bg-[#080E1E]/89 dark:text-white/70"
            )}>
              {t("loadingPreview")}
            </div>
          )}
        </div>

        {/* Coin Picker */}
        <div className={cn("mt-4", UI.panel)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">
                {t("coinSelectTitle")} ({selectedCount}/{availableCoins.length})
              </div>
              <div className={cn("text-sm mt-1", UI.muted)}>{t("rpCoinSearchHint")}</div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div
                className={cn(
                  "rounded-2xl p-1 flex items-center",
                  "bg-black/5 border border-black/10",
                  "dark:bg-white/5 dark:border-white/10",
                )}
              >
                <button
                  type="button"
                  onClick={() => setWatchlistOnly(false)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-sm transition-colors duration-200",
                    !watchlistOnly
                      ? "bg-black/10 text-black/85 dark:bg-white/15 dark:text-white/90"
                      : "text-black/60 hover:text-black dark:text-white/70 dark:hover:text-white",
                  )}
                >
                  {t("allCoins")}
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistOnly(true)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-sm transition-colors duration-200",
                    watchlistOnly
                      ? "bg-black/10 text-black/85 dark:bg-white/15 dark:text-white/90"
                      : "text-black/60 hover:text-black dark:text-white/70 dark:hover:text-white",
                  )}
                >
                  {t("watchlist")} ({watchlistCoins.length})
                </button>
              </div>

              <div className="relative">
                <div className={cn(
                  "flex items-center gap-2 rounded-2xl border px-3 py-2 w-[280px]",
                  "border-slate-200/70 bg-white/70",
                  "dark:border-white/10 dark:bg-[#080E1E]/89"
                )}>
                  <Search className="h-4 w-4 opacity-60" />
                  <input
                    value={searchInput}
                    onChange={(e) => { setSearchInput(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder={t("searchCoin")}
                    className="bg-transparent outline-none text-sm w-full placeholder:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </button>
                </div>

                {dropdownOpen && suggestions.length > 0 && (
                  <div className={cn(
                    "absolute z-20 mt-2 w-full rounded-2xl border overflow-hidden",
                    "border-slate-200/70 bg-white",
                    "dark:border-white/10 dark:bg-slate-950/95"
                  )}>
                    {suggestions.map((c) => (
                      <button
                        key={c}
                        className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/10"
                        onClick={() => {
                          toggleCoin(c);
                          setSearchInput("");
                          setSearch("");
                          setDropdownOpen(false);
                        }}
                        type="button"
                      >
                        <span>{c}</span>
                        {selected.has(String(c)) && <Check className="h-4 w-4 opacity-80" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={selectAll}
              className={cn(
                "px-4 py-2 rounded-xl border text-sm transition",
                "border-slate-200/70 bg-white/70 hover:bg-black/5",
                "dark:border-white/10 dark:bg-[#080E1E]/89 dark:hover:bg-white/10"
              )}
              type="button"
            >
              {t("selectAll")}
            </button>
            <button
              onClick={clearAll}
              className={cn(
                "px-4 py-2 rounded-xl border text-sm transition",
                "border-slate-200/70 bg-white/70 hover:bg-black/5",
                "dark:border-white/10 dark:bg-[#080E1E]/89 dark:hover:bg-white/10"
              )}
              type="button"
            >
              {t("clear")}
            </button>
          </div>

          {/* (p-1 + ring-inset) */}
          <div className="mt-4 p-1 pr-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[320px] overflow-auto">
            {filteredCoins.length === 0 ? (
              <div
                className={cn(
                  "col-span-full rounded-xl border px-4 py-3 text-sm",
                  "border-slate-200/70 bg-white/70 text-slate-600",
                  "dark:border-white/10 dark:bg-[#080E1E]/89 dark:text-white/60",
                )}
              >
                {watchlistOnly ? t("rpNoWatchlistCoins") : t("rpNoCoinMatch")}
              </div>
            ) : null}

            {filteredCoins.map((c) => {
              const key = String(c);
              const on = selected.has(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleCoin(key)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm flex items-center justify-between transition",
                    "border-slate-200/70 bg-white/70 hover:bg-black/5",
                    "dark:border-white/10 dark:bg-[#080E1E]/89 dark:hover:bg-white/10",
                    on && "ring-2 ring-inset ring-emerald-400/60"
                  )}
                  type="button"
                >
                  <span className="font-semibold">{key}</span>
                  <span
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center",
                      on
                        ? "bg-emerald-400/20 border-emerald-400/40"
                        : "border-slate-300/70 dark:border-white/20"
                    )}
                  >
                    {on && <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-200" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <DataTable title={t("rawPreviewTitle")} headers={rawPreview.headers} rows={rawPreview.rows} />
        <DataTable title={t("cleanPreviewTitle")} headers={cleanPreview.headers} rows={cleanPreview.rows} />

        {/* How it works */}
        <div className={cn("mt-4", UI.panel)}>
          <div className="text-lg font-semibold">{t("rpHowTitle")}</div>
          <div className={cn("mt-1 text-sm", UI.muted)}>{t("rpHowSubtitle")}</div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {howSteps.map((s) => (
              <HowStepCard
                key={s.step}
                step={s.step}
                title={s.title}
                desc={s.desc}
                icon={s.icon}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

