import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogIn, LogOut, UserPlus, UserRound, X } from "lucide-react";
import { apiUrl } from "../lib/api";

const TOKEN_KEY = "eglc_auth_token";
const AUTH_EVENT = "eglc-auth-change";
const AUTH_MODAL_TRANSITION_MS = 300;

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch (e) {
    void e;
    return "";
  }
}

function writeStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    void e;
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

async function requestMe(token) {
  const res = await fetch(apiUrl("/api/auth/me"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.detail || `HTTP ${res.status}`);
  }
  return payload?.user || null;
}

export default function AuthBar() {
  const [token, setToken] = useState(() => readStoredToken());
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(false);

  const [mode, setMode] = useState(null); // "login" | "signup" | null
  const [modalVisible, setModalVisible] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [portalRoot, setPortalRoot] = useState(null);
  const closeTimerRef = useRef(null);

  const isSignup = mode === "signup";

  const resetForm = useCallback(() => {
    setUsername("");
    setPassword("");
    setError("");
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSubmitting(false);
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setMode(null);
      resetForm();
      closeTimerRef.current = null;
    }, AUTH_MODAL_TRANSITION_MS);
  }, [clearCloseTimer, resetForm]);

  const openLogin = useCallback(() => {
    clearCloseTimer();
    resetForm();
    setMode("login");
    setModalVisible(false);
  }, [clearCloseTimer, resetForm]);

  const openSignup = useCallback(() => {
    clearCloseTimer();
    resetForm();
    setMode("signup");
    setModalVisible(false);
  }, [clearCloseTimer, resetForm]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== TOKEN_KEY) return;
      setToken(e.newValue || "");
    };
    const onAuthSync = () => {
      setToken(readStoredToken());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(AUTH_EVENT, onAuthSync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AUTH_EVENT, onAuthSync);
    };
  }, []);

  useEffect(() => {
    if (!mode) {
      setModalVisible(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => setModalVisible(true));
    return () => window.cancelAnimationFrame(raf);
  }, [mode]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!mode) return undefined;

    const scrollY = window.scrollY;
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;
    const prevBodyPosition = bodyEl.style.position;
    const prevBodyTop = bodyEl.style.top;
    const prevBodyLeft = bodyEl.style.left;
    const prevBodyRight = bodyEl.style.right;
    const prevBodyWidth = bodyEl.style.width;
    const prevBodyPaddingRight = bodyEl.style.paddingRight;

    const scrollbarWidth = Math.max(
      0,
      window.innerWidth - htmlEl.clientWidth,
    );
    const computedPaddingRight =
      Number.parseFloat(window.getComputedStyle(bodyEl).paddingRight) || 0;

    htmlEl.style.overflow = "hidden";
    bodyEl.style.overflow = "hidden";
    bodyEl.style.position = "fixed";
    bodyEl.style.top = `-${scrollY}px`;
    bodyEl.style.left = "0";
    bodyEl.style.right = "0";
    bodyEl.style.width = "100%";
    if (scrollbarWidth > 0) {
      bodyEl.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
    }

    return () => {
      htmlEl.style.overflow = prevHtmlOverflow;
      bodyEl.style.overflow = prevBodyOverflow;
      bodyEl.style.position = prevBodyPosition;
      bodyEl.style.top = prevBodyTop;
      bodyEl.style.left = prevBodyLeft;
      bodyEl.style.right = prevBodyRight;
      bodyEl.style.width = prevBodyWidth;
      bodyEl.style.paddingRight = prevBodyPaddingRight;
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    };
  }, [mode]);

  useEffect(() => {
    let alive = true;
    if (!token) {
      setUser(null);
      return () => {
        alive = false;
      };
    }

    setCheckingSession(true);
    requestMe(token)
      .then((nextUser) => {
        if (!alive) return;
        setUser(nextUser);
      })
      .catch(() => {
        if (!alive) return;
        setUser(null);
        setToken("");
        writeStoredToken("");
      })
      .finally(() => {
        if (!alive) return;
        setCheckingSession(false);
      });

    return () => {
      alive = false;
    };
  }, [token]);

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (submitting || !mode) return;

      setSubmitting(true);
      setError("");
      try {
        const body = { username: username.trim(), password };

        const res = await fetch(apiUrl(isSignup ? "/api/auth/signup" : "/api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.detail || `HTTP ${res.status}`);
        }

        const nextToken = String(payload?.token || "");
        const nextUser = payload?.user || null;
        if (!nextToken || !nextUser) {
          throw new Error("Invalid auth response from server.");
        }

        writeStoredToken(nextToken);
        setToken(nextToken);
        setUser(nextUser);
        closeModal();
      } catch (err) {
        setError(String(err?.message || err));
      } finally {
        setSubmitting(false);
      }
    },
    [closeModal, isSignup, mode, password, submitting, username],
  );

  const onLogout = useCallback(() => {
    writeStoredToken("");
    setToken("");
    setUser(null);
  }, []);

  const userLabel = useMemo(() => {
    if (!user) return "";
    return user?.username || user?.name || "User";
  }, [user]);

  const authModal = mode ? (
    <div
      className={cn(
        "fixed inset-0 z-[100] grid place-items-center p-4 sm:p-6 overflow-y-auto",
        "transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        modalVisible ? "opacity-100" : "opacity-0",
      )}
    >
      <button
        type="button"
        onClick={closeModal}
        className={cn(
          "absolute inset-0 bg-[#120f2a]/45 backdrop-blur-[4px]",
          "transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          modalVisible ? "opacity-100" : "opacity-0",
        )}
        aria-label="Close auth modal"
      />
      <div
        className={cn(
          "relative my-auto w-full max-w-md rounded-3xl border p-5 transform-gpu",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          modalVisible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-5 scale-95",
          "bg-[linear-gradient(145deg,rgba(248,236,219,0.96),rgba(207,194,255,0.93),rgba(182,198,255,0.9))]",
          "border-[#7f6ad3]/28 text-slate-900 shadow-[0_30px_90px_rgba(74,64,136,0.34)]",
          "dark:bg-[linear-gradient(145deg,rgba(8,14,30,0.95),rgba(42,26,102,0.9),rgba(7,25,53,0.9))]",
          "dark:border-[#a494ff]/30 dark:text-white dark:shadow-[0_30px_95px_rgba(2,6,23,0.78)]",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">
              {isSignup ? "Create Account" : "Welcome Back"}
            </div>
            <div className="text-sm opacity-70">
              {isSignup ? "Sign up to start using the app." : "Log in to your account."}
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-xl p-2 transition hover:bg-indigo-500/12 dark:hover:bg-indigo-300/16"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs opacity-75">Username</span>
            <input
              required
              minLength={3}
              maxLength={32}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={cn(
                "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                "bg-white/70 border-indigo-900/15 focus:ring-2 focus:ring-indigo-500/35",
                "dark:bg-[#0B1735]/75 dark:border-[#b3a3ff]/24 dark:focus:ring-indigo-300/30",
              )}
              placeholder="username"
            />
          </label>

          <label className="block">
            <span className="text-xs opacity-75">Password</span>
            <input
              required
              minLength={8}
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                "bg-white/70 border-indigo-900/15 focus:ring-2 focus:ring-indigo-500/35",
                "dark:bg-[#0B1735]/75 dark:border-[#b3a3ff]/24 dark:focus:ring-indigo-300/30",
              )}
              placeholder="At least 8 characters"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className={cn(
              "w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              "bg-[linear-gradient(90deg,#5b39d5,#4b79ff)] text-white hover:brightness-110",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          >
            {submitting ? "Please wait..." : isSignup ? "Sign Up" : "Log In"}
          </button>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      {user ? (
        <div
          className={cn(
            "w-full rounded-2xl p-1 flex items-center justify-between gap-1 border sm:w-auto sm:justify-start",
            "bg-black/5 border-black/10 text-black/75",
            "dark:bg-white/8 dark:border-white/12 dark:text-white/80",
          )}
        >
          <div className="px-2.5 py-1.5 rounded-xl text-sm flex items-center gap-2 max-w-[120px] sm:px-3 sm:max-w-[190px]">
            <UserRound className="h-4 w-4 shrink-0 opacity-80" />
            <span className="truncate">{checkingSession ? "..." : userLabel}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className={cn(
              "px-2.5 py-1.5 rounded-xl text-sm flex items-center gap-2 transition sm:px-3",
              "hover:bg-black/8 dark:hover:bg-white/12",
            )}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "w-full rounded-2xl p-1 flex items-center justify-between gap-1 border sm:w-auto sm:justify-start",
            "bg-black/5 border-black/10",
            "dark:bg-white/8 dark:border-white/12",
          )}
        >
          <button
            type="button"
            onClick={openLogin}
            className={cn(
              "px-2.5 py-1.5 rounded-xl text-sm flex items-center gap-2 transition sm:px-3",
              "text-black/75 hover:bg-black/8",
              "dark:text-white/80 dark:hover:bg-white/12",
            )}
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Log In</span>
          </button>
          <button
            type="button"
            onClick={openSignup}
            className={cn(
              "px-2.5 py-1.5 rounded-xl text-sm flex items-center gap-2 transition sm:px-3",
              "bg-black/10 text-black/85 hover:bg-black/15",
              "dark:bg-white/15 dark:text-white/90 dark:hover:bg-white/20",
            )}
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Up</span>
          </button>
        </div>
      )}

      {portalRoot && authModal ? createPortal(authModal, portalRoot) : null}
    </>
  );
}
