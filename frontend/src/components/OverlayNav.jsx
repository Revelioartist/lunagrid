import React, { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X, Database, ArrowLeftRight } from "lucide-react";

const cn = (...xs) => xs.filter(Boolean).join(" ");
const DESKTOP_CLOSE_DELAY_MS = 180;
const COMPACT_DOCK_HIDE_CLASS = "-translate-x-[96px]";
const SIDE_DRAWER_SCREEN_RATIO = 0.5;

function readViewport() {
  if (typeof window === "undefined") {
    return { width: 1024, screenWidth: 1920 };
  }

  const width = window.innerWidth || 0;
  const screenWidth = window.screen?.availWidth || window.screen?.width || width;
  return { width, screenWidth };
}

function MenuGlyph({ open }) {
  return (
    <span className="relative block h-5 w-5">
      <Menu
        className={cn(
          "absolute inset-0 h-5 w-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100",
        )}
      />
      <X
        className={cn(
          "absolute inset-0 h-5 w-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75",
        )}
      />
    </span>
  );
}

function NavItem({ id, label, icon, activeId, onClick, onAfterClick }) {
  const isActive = activeId === id;

  return (
    <div className="relative group">
      <button
        onClick={() => {
          onClick?.();
          onAfterClick?.();
        }}
        className={cn(
          "w-12 h-12 rounded-2xl border flex items-center justify-center transition",
          "backdrop-blur",
          isActive
            ? "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.08)]"
            : "bg-black/3 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10",
        )}
        title={label}
        aria-label={label}
        type="button"
      >
        {icon}
      </button>

      <div
        className={cn(
          "pointer-events-none hidden md:flex absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2",
          "rounded-lg border px-2.5 py-1 text-xs whitespace-nowrap backdrop-blur",
          "border-black/10 bg-white/90 text-slate-800 shadow-sm",
          "dark:border-white/10 dark:bg-slate-900/90 dark:text-white/85",
          "opacity-0 translate-x-1 transition-all duration-150",
          "group-hover:opacity-100 group-hover:translate-x-0",
          "group-focus-within:opacity-100 group-focus-within:translate-x-0",
        )}
      >
        {label}
      </div>
    </div>
  );
}

export default function OverlayNav({ active, onGoEth, onGoReport }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopHoverOpen, setDesktopHoverOpen] = useState(false);
  const [viewport, setViewport] = useState(readViewport);
  const sideDrawerModeRef = useRef(
    viewport.width <= Math.floor(viewport.screenWidth * SIDE_DRAWER_SCREEN_RATIO),
  );
  const desktopCloseTimerRef = useRef(null);
  const halfScreenWidth = Math.floor(viewport.screenWidth * SIDE_DRAWER_SCREEN_RATIO);
  const forceSideDrawer = viewport.width <= halfScreenWidth;

  const clearDesktopCloseTimer = useCallback(() => {
    if (desktopCloseTimerRef.current) {
      window.clearTimeout(desktopCloseTimerRef.current);
      desktopCloseTimerRef.current = null;
    }
  }, []);

  const closeDrawer = useCallback(() => setMobileOpen(false), []);
  const toggleMobileMenu = useCallback(() => setMobileOpen((v) => !v), []);
  const openDesktopMenu = useCallback(() => {
    clearDesktopCloseTimer();
    setDesktopHoverOpen(true);
  }, [clearDesktopCloseTimer]);
  const toggleDesktopMenu = useCallback(() => {
    clearDesktopCloseTimer();
    setDesktopHoverOpen((v) => !v);
  }, [clearDesktopCloseTimer]);
  const closeDesktopMenuWithDelay = useCallback(() => {
    clearDesktopCloseTimer();
    desktopCloseTimerRef.current = window.setTimeout(() => {
      setDesktopHoverOpen(false);
      desktopCloseTimerRef.current = null;
    }, DESKTOP_CLOSE_DELAY_MS);
  }, [clearDesktopCloseTimer]);

  useEffect(() => () => clearDesktopCloseTimer(), [clearDesktopCloseTimer]);

  useEffect(() => {
    const onResize = () => {
      const nextViewport = readViewport();
      const nextHalfScreenWidth = Math.floor(
        nextViewport.screenWidth * SIDE_DRAWER_SCREEN_RATIO,
      );
      const nextForceSideDrawer = nextViewport.width <= nextHalfScreenWidth;

      if (sideDrawerModeRef.current !== nextForceSideDrawer) {
        if (nextForceSideDrawer) {
          setDesktopHoverOpen(false);
        } else {
          setMobileOpen(false);
        }
        sideDrawerModeRef.current = nextForceSideDrawer;
      }

      setViewport(nextViewport);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      {!forceSideDrawer ? (
        <div className="hidden lg:block fixed left-4 top-4 z-50">
          <div
            className="relative"
            onMouseEnter={openDesktopMenu}
            onMouseLeave={closeDesktopMenuWithDelay}
          >
            <button
              className={cn(
                "rounded-2xl border backdrop-blur p-3",
                "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "hover:scale-[1.02] active:scale-95",
                "border-black/10 dark:border-white/10",
                "bg-white/70 dark:bg-white/5",
                "text-slate-900/90 dark:text-white/80",
              )}
              onFocus={openDesktopMenu}
              onBlur={closeDesktopMenuWithDelay}
              aria-label="Toggle navigation"
              aria-expanded={desktopHoverOpen}
              type="button"
            >
              <MenuGlyph open={desktopHoverOpen} />
            </button>

            <div
              className={cn(
                "absolute left-0 top-[calc(100%+6px)] flex flex-col gap-3 origin-top transform-gpu",
                "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                desktopHoverOpen
                  ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                  : "opacity-0 -translate-y-4 scale-95 pointer-events-none",
              )}
            >
              <NavItem
                id="eth"
                label="ETH Data"
                icon={
                  <Database className="h-5 w-5 text-slate-900/90 dark:text-white/80" />
                }
                activeId={active}
                onClick={onGoEth}
              />
              <NavItem
                id="report"
                label="Report Price"
                icon={
                  <ArrowLeftRight className="h-5 w-5 text-slate-900/90 dark:text-white/80" />
                }
                activeId={active}
                onClick={onGoReport}
              />
            </div>
          </div>
        </div>
      ) : null}

      {!forceSideDrawer ? (
        <div className="hidden md:block lg:hidden fixed left-0 top-1/2 -translate-y-1/2 z-50">
          <div
            className="relative"
            onMouseEnter={openDesktopMenu}
            onMouseLeave={closeDesktopMenuWithDelay}
          >
            <div
              className={cn(
                "flex items-center transform-gpu",
                "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                desktopHoverOpen
                  ? "translate-x-0"
                  : COMPACT_DOCK_HIDE_CLASS,
              )}
            >
              <div className="w-20 p-4 flex flex-col gap-3 rounded-r-2xl border-r border-y bg-white/70 dark:bg-slate-950/45 border-black/10 dark:border-white/15 backdrop-blur-xl shadow-sm">
                <NavItem
                  id="eth"
                  label="ETH Data"
                  icon={
                    <Database className="h-5 w-5 text-slate-900/90 dark:text-white/80" />
                  }
                  activeId={active}
                  onClick={onGoEth}
                />
                <NavItem
                  id="report"
                  label="Report Price"
                  icon={
                    <ArrowLeftRight className="h-5 w-5 text-slate-900/90 dark:text-white/80" />
                  }
                  activeId={active}
                  onClick={onGoReport}
                />
              </div>

              <button
                className={cn(
                  "h-14 w-7 rounded-r-xl border border-l-0 backdrop-blur overflow-hidden",
                  "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "hover:scale-[1.02] active:scale-95",
                  "border-black/10 dark:border-white/10",
                  "bg-white/70 dark:bg-white/5",
                  "text-slate-900/90 dark:text-white/80",
                )}
                onClick={toggleDesktopMenu}
                onFocus={openDesktopMenu}
                onBlur={closeDesktopMenuWithDelay}
                aria-label="Toggle navigation"
                aria-expanded={desktopHoverOpen}
                type="button"
              >
                <span className="-translate-x-[2px] scale-75 block">
                  <MenuGlyph open={desktopHoverOpen} />
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        onClick={toggleMobileMenu}
        className={cn(
          forceSideDrawer ? "block" : "md:hidden",
          "fixed top-4 left-4 z-50 rounded-2xl border backdrop-blur p-3",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:scale-[1.02] active:scale-95",
          "border-black/10 dark:border-white/10",
          "bg-white/70 dark:bg-white/5",
          "text-slate-900/90 dark:text-white/80",
        )}
        aria-label="Toggle navigation"
        aria-expanded={mobileOpen}
        type="button"
      >
        <MenuGlyph open={mobileOpen} />
      </button>

      {mobileOpen && (
        <div className={cn(forceSideDrawer ? "block" : "md:hidden", "fixed inset-0 z-40")}>
          <div
            className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
            onClick={closeDrawer}
            role="button"
            tabIndex={0}
          />
          <div className="absolute left-0 top-0 h-full w-20 px-4 pt-20 pb-4 flex flex-col gap-3 bg-white/70 dark:bg-slate-950/45 border-r border-black/10 dark:border-white/15 backdrop-blur-xl">
            <NavItem
              id="eth"
              label="ETH Data"
              icon={
                <Database className="h-5 w-5 text-slate-900/90 dark:text-white/80" />
              }
              activeId={active}
              onClick={onGoEth}
              onAfterClick={closeDrawer}
            />
            <NavItem
              id="report"
              label="Report Price"
              icon={
                <ArrowLeftRight className="h-5 w-5 text-slate-900/90 dark:text-white/80" />
              }
              activeId={active}
              onClick={onGoReport}
              onAfterClick={closeDrawer}
            />
          </div>
        </div>
      )}
    </>
  );
}
