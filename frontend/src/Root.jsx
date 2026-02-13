import React, {
  lazy,
  Profiler,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp } from "lucide-react";
import App from "./App";
import OverlayNav from "./components/OverlayNav";

const ReportPrice = lazy(() => import("./pages/ReportPrice"));
const IS_DEV = import.meta.env.DEV;
const ROUTE_LOADING_SWEEP_MS = 950;
const ROUTE_LOADING_MIN_VISIBLE_MS = 300;
const PAGE_TRANSITION_EXIT_MS = 190;
const PAGE_TRANSITION_ENTER_MS = 430;

function usePath() {
  const [path, setPath] = useState(() => window.location.pathname || "/");

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || "/");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return [path, setPath];
}

export default function Root() {
  const { t } = useTranslation();
  const [path, setPath] = usePath();
  const [displayPath, setDisplayPath] = useState(path);
  const [pageTransitionPhase, setPageTransitionPhase] = useState("idle");
  const [routeLoading, setRouteLoading] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const bgHostRef = useRef(null);
  const loadingTimerRef = useRef(null);
  const pageTransitionTimerRef = useRef(null);
  const loadingStartedAtRef = useRef(0);

  const clearLoadingTimer = useCallback(() => {
    if (loadingTimerRef.current) {
      window.clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearLoadingTimer(), [clearLoadingTimer]);

  const clearPageTransitionTimer = useCallback(() => {
    if (pageTransitionTimerRef.current) {
      window.clearTimeout(pageTransitionTimerRef.current);
      pageTransitionTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearPageTransitionTimer(), [clearPageTransitionTimer]);

  const navigate = useCallback(
    (to) => {
      if (to === window.location.pathname) return;
      clearLoadingTimer();
      loadingStartedAtRef.current = performance.now();
      setRouteLoading(true);
      window.history.pushState({}, "", to);
      setPath(to);
    },
    [clearLoadingTimer, setPath],
  );

  const onGoEth = useCallback(() => navigate("/"), [navigate]);
  const onGoReport = useCallback(() => navigate("/report-price"), [navigate]);

  const activePage = path.startsWith("/report-price") ? "report" : "eth";
  const isReportView = displayPath.startsWith("/report-price");
  const profileId = isReportView ? "report-price" : "express-gl";

  const onRender = useCallback((id, phase, actualDuration) => {
    if (!IS_DEV) return;
    console.info(
      `[perf][render] ${id} phase=${phase} duration=${actualDuration.toFixed(2)}ms`,
    );
  }, []);

  useEffect(() => {
    if (!routeLoading) return;

    clearLoadingTimer();
    const now = performance.now();
    const elapsed = Math.max(0, now - loadingStartedAtRef.current);

    // Keep bar alive until the animation reaches the right edge.
    const progressInSweep = elapsed % ROUTE_LOADING_SWEEP_MS;
    const sweepRemaining = ROUTE_LOADING_SWEEP_MS - progressInSweep;
    const minVisibleRemaining = Math.max(
      0,
      ROUTE_LOADING_MIN_VISIBLE_MS - elapsed,
    );
    const hideAfter = Math.max(sweepRemaining, minVisibleRemaining);

    loadingTimerRef.current = window.setTimeout(() => {
      setRouteLoading(false);
      loadingTimerRef.current = null;
    }, hideAfter);

    return clearLoadingTimer;
  }, [clearLoadingTimer, path, routeLoading]);

  useEffect(() => {
    if (path === displayPath) return;

    clearPageTransitionTimer();
    pageTransitionTimerRef.current = window.setTimeout(() => {
      setPageTransitionPhase("exit");

      pageTransitionTimerRef.current = window.setTimeout(() => {
        setDisplayPath(path);
        setPageTransitionPhase("enter");

        pageTransitionTimerRef.current = window.setTimeout(() => {
          setPageTransitionPhase("idle");
          pageTransitionTimerRef.current = null;
        }, PAGE_TRANSITION_ENTER_MS);
      }, PAGE_TRANSITION_EXIT_MS);
    }, 0);

    return clearPageTransitionTimer;
  }, [clearPageTransitionTimer, displayPath, path]);

  useEffect(() => {
    const hostEl = bgHostRef.current;
    if (!hostEl) return;

    let rafId = 0;
    let lastY = window.scrollY;
    let lastScrollTs = performance.now();
    let lastAnimTs = performance.now();
    let velocity = 0;
    let targetRotate = 0;
    let targetZoom = 1;
    let targetIntensity = 0;
    let currentRotate = 0;
    let currentZoom = 1;
    let currentIntensity = 0;

    const getMaxScrollable = () =>
      Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);

    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

    const writeMotion = () => {
      hostEl.style.setProperty(
        "--tech-scroll-rotate",
        `${currentRotate.toFixed(2)}deg`,
      );
      hostEl.style.setProperty("--tech-scroll-zoom", currentZoom.toFixed(4));
      hostEl.style.setProperty(
        "--tech-scroll-intensity",
        currentIntensity.toFixed(4),
      );
    };

    const updateTargets = () => {
      const y = window.scrollY;
      const now = performance.now();
      const dt = Math.max(now - lastScrollTs, 16);
      const dy = y - lastY;
      const instantVelocity = dy / dt;

      velocity = velocity * 0.86 + instantVelocity * 0.14;

      const progress = clamp(y / getMaxScrollable(), 0, 1);
      const scrollRotateDeg = y * 0.065;
      const baseZoom = 1 + progress * 0.025;
      const directionalZoom = clamp(velocity * 0.42, -0.05, 0.05);

      targetRotate = scrollRotateDeg;
      targetZoom = clamp(baseZoom + directionalZoom, 0.95, 1.09);
      targetIntensity = clamp(Math.abs(velocity) * 0.9, 0, 0.65);

      setShowScrollTop(y > 260);

      lastY = y;
      lastScrollTs = now;
    };

    const animate = (now) => {
      const dtScale = clamp((now - lastAnimTs) / 16.6667, 0.7, 2.4);
      const lerp = 1 - Math.pow(0.78, dtScale);

      currentRotate += (targetRotate - currentRotate) * lerp;
      currentZoom += (targetZoom - currentZoom) * lerp;
      currentIntensity += (targetIntensity - currentIntensity) * lerp;

      writeMotion();
      lastAnimTs = now;

      const settled =
        Math.abs(targetRotate - currentRotate) < 0.03 &&
        Math.abs(targetZoom - currentZoom) < 0.0006 &&
        Math.abs(targetIntensity - currentIntensity) < 0.003;

      if (settled) {
        rafId = 0;
        return;
      }

      rafId = window.requestAnimationFrame(animate);
    };

    const ensureAnimation = () => {
      if (!rafId) {
        lastAnimTs = performance.now();
        rafId = window.requestAnimationFrame(animate);
      }
    };

    const onScrollOrResize = () => {
      updateTargets();
      ensureAnimation();
    };

    updateTargets();
    currentRotate = targetRotate;
    currentZoom = targetZoom;
    currentIntensity = targetIntensity;
    writeMotion();

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  const onScrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const pageTransitionClass =
    pageTransitionPhase === "exit"
      ? "page-route-stage is-exit"
      : pageTransitionPhase === "enter"
        ? "page-route-stage is-enter"
        : "page-route-stage is-idle";

  return (
    <div ref={bgHostRef} className="app-tech-bg min-h-screen flex flex-col">
      <div className="app-tech-backdrop" aria-hidden="true" />
      <div className="app-tech-mesh" aria-hidden="true" />

      {routeLoading ? (
        <div className="route-loading-wrap" aria-hidden="true">
          <div className="route-loading-bar" />
        </div>
      ) : null}

      <OverlayNav
        active={activePage}
        onGoEth={onGoEth}
        onGoReport={onGoReport}
      />

      <button
        type="button"
        onClick={onScrollTop}
        aria-label="Back to top"
        className={`fixed right-5 bottom-5 z-[60] h-11 w-11 rounded-full border backdrop-blur-md
          bg-white/80 border-slate-300/70 text-slate-800 shadow-lg
          dark:bg-slate-900/75 dark:border-white/20 dark:text-white/85
          transition-all duration-300
          hover:-translate-y-0.5 hover:shadow-xl
          ${showScrollTop ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none"}`}
      >
        <ArrowUp className="mx-auto h-5 w-5" />
      </button>

      <div className="relative z-10 flex-1 pt-20 md:pt-0 transition-[padding] duration-200">
        <div className={pageTransitionClass}>
          <Profiler id={profileId} onRender={onRender}>
            {isReportView ? (
              <Suspense fallback={null}>
                <ReportPrice />
              </Suspense>
            ) : (
              <App />
            )}
          </Profiler>
        </div>
      </div>

      <footer className="relative z-20 border-t border-black/10 dark:border-white/12 bg-white/65 dark:bg-[#060d22]/78 backdrop-blur-md">
        <div className="w-full px-3 md:px-4 py-3 text-xs md:text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 text-black/70 dark:text-white/75">
          <span>{t("privacyPolicyNotice")}</span>
          <span className="font-semibold text-rose-700 dark:text-rose-300">
            {t("nonCommercialStrict")}
          </span>
        </div>
      </footer>
    </div>
  );
}
