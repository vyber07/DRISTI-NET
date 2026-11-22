import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { usePortalStore } from "@/stores/portalStore";

/**
 * Thin wrapper over the Fullscreen API, including the WebKit-prefixed variant older Safari (iPadOS < 16.4) still uses.
 * iPhone Safari and sandboxed iframes have no element full screen at all: callers fall back to a CSS full-window mode.
 */
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function nativeFullscreenSupported(): boolean {
  const d = document as FsDocument;
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function fullscreenElement(): Element | null {
  const d = document as FsDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/** Resolves true when the browser entered full screen, false when it refused (no support, policy, no user gesture). */
export async function enterNativeFullscreen(el: HTMLElement): Promise<boolean> {
  const e = el as FsElement;
  try {
    if (e.requestFullscreen) await e.requestFullscreen({ navigationUI: "hide" });
    else if (e.webkitRequestFullscreen) await e.webkitRequestFullscreen();
    else return false;
    return fullscreenElement() === el;
  } catch {
    return false;
  }
}

export async function exitNativeFullscreen(): Promise<void> {
  const d = document as FsDocument;
  if (!fullscreenElement()) return;
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
  } catch {
    /* already left (e.g. the user pressed Esc) */
  }
}

export const FULLSCREEN_CHANGE_EVENTS = ["fullscreenchange", "webkitfullscreenchange"] as const;

export type FullscreenMode = "native" | "window" | null;

/** True while a modal dialog is open (its own Esc handling must win). */
export function dialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
}

/**
 * Full screen for one element without remounting it (P1.5): the same DOM subtree is shown full screen, so component
 * state, the graph engine, its camera and the store are untouched and nothing is fetched again.
 * - "native": the browser Fullscreen API. The browser's own Esc / exit UI is followed through fullscreenchange.
 * - "window": a CSS full-window fallback where the API is unavailable or refused (iPhone Safari, sandboxed iframes);
 *   Esc exits unless a dialog is open, and the page behind does not scroll.
 * While active, dialogs and tooltips portal into the element (stores/portalStore.ts) so they stay visible.
 */
export function useElementFullscreen(ref: RefObject<HTMLElement | null>) {
  const [mode, setMode] = useState<FullscreenMode>(null);
  const modeRef = useRef<FullscreenMode>(null);
  const setContainer = usePortalStore((s) => s.setContainer);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Follow exits the page did not start (Esc, the browser's own UI, another element taking full screen).
  useEffect(() => {
    const onChange = () => {
      if (modeRef.current === "native" && fullscreenElement() !== ref.current) setMode(null);
    };
    FULLSCREEN_CHANGE_EVENTS.forEach((e) => document.addEventListener(e, onChange));
    return () => FULLSCREEN_CHANGE_EVENTS.forEach((e) => document.removeEventListener(e, onChange));
  }, [ref]);

  useEffect(() => {
    if (mode !== "window") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && !dialogOpen()) setMode(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [mode]);

  useEffect(() => { setContainer(mode ? ref.current : null); }, [mode, ref, setContainer]);

  // Leaving the page (navigation, case switch) always leaves full screen and restores portals to <body>.
  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el && fullscreenElement() === el) void exitNativeFullscreen();
      setContainer(null);
    };
  }, [ref, setContainer]);

  const enter = useCallback(async () => {
    const el = ref.current;
    if (!el || modeRef.current) return;
    const next: FullscreenMode = nativeFullscreenSupported() && await enterNativeFullscreen(el) ? "native" : "window";
    modeRef.current = next;
    setMode(next);
  }, [ref]);

  const exit = useCallback(async () => {
    const was = modeRef.current;
    modeRef.current = null;
    if (was === "native") await exitNativeFullscreen();
    setMode(null);
  }, []);

  const toggle = useCallback(() => { void (modeRef.current ? exit() : enter()); }, [enter, exit]);

  return { mode, isFullscreen: mode !== null, enter, exit, toggle };
}
