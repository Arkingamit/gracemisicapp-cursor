"use client";

import { useEffect, useState } from "react";

const KEYBOARD_MIN_PX = 120;

function isTextFieldFocused(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || !!el.isContentEditable;
}

/** Measure soft-keyboard overlap. Ignores small viewport chrome (avoids bottom gaps). */
export function measureKeyboardInset(): number {
  if (typeof window === "undefined") return 0;
  const vv = window.visualViewport;
  if (!vv) return 0;
  // Only lift UI while typing — otherwise Android WebView reports a false inset
  // that leaves a black gap above the bottom nav.
  if (!isTextFieldFocused()) return 0;
  const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  return inset >= KEYBOARD_MIN_PX ? inset : 0;
}

/**
 * Tracks keyboard overlap for fixed full-screen chat panels.
 * Returns 0 when the keyboard is closed so panels stay edge-to-edge.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setInset(0);
      return;
    }

    const update = () => setInset(measureKeyboardInset());

    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      setInset(0);
    };
  }, [enabled]);

  return inset;
}
