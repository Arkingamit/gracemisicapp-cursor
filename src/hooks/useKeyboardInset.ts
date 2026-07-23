"use client";

import { useEffect, useState } from "react";

import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

const KEYBOARD_MIN_PX = 120;

function isTextFieldFocused(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || !!el.isContentEditable;
}

/**
 * Measure soft-keyboard overlap via VisualViewport.
 * Returns 0 when the layout viewport already resized (adjustResize /
 * interactive-widget=resizes-content), so callers don't double-inset.
 */
export function measureKeyboardInset(): number {
  if (typeof window === "undefined") return 0;
  const vv = window.visualViewport;
  if (!vv) return 0;
  if (!isTextFieldFocused()) return 0;
  const inset = Math.max(
    0,
    Math.round(window.innerHeight - vv.height - vv.offsetTop)
  );
  return inset >= KEYBOARD_MIN_PX ? inset : 0;
}

/**
 * Tracks keyboard overlap for fixed full-screen panels (chat, AI builder).
 * Always measures via VisualViewport so Android adjustResize and Capacitor
 * Keyboard height events never double-count.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setInset(0);
      return;
    }

    let cancelled = false;
    const update = () => {
      if (!cancelled) setInset(measureKeyboardInset());
    };

    update();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);

    const removals: Array<() => void> = [];

    if (Capacitor.isNativePlatform()) {
      // Native events are triggers only — height comes from visualViewport.
      const attach = (
        event:
          | "keyboardWillShow"
          | "keyboardDidShow"
          | "keyboardWillHide"
          | "keyboardDidHide",
        handler: () => void
      ) => {
        Keyboard.addListener(event, handler).then((handle) => {
          if (cancelled) {
            handle.remove();
            return;
          }
          removals.push(() => {
            handle.remove();
          });
        });
      };

      attach("keyboardWillShow", update);
      attach("keyboardDidShow", update);
      attach("keyboardWillHide", () => {
        if (!cancelled) setInset(0);
      });
      attach("keyboardDidHide", () => {
        if (!cancelled) setInset(0);
      });
    }

    return () => {
      cancelled = true;
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      removals.forEach((remove) => remove());
      setInset(0);
    };
  }, [enabled]);

  return inset;
}

/**
 * Whether the soft keyboard is open. True even when the layout viewport
 * already resized (inset === 0), so chrome like the bottom nav can hide.
 */
export function useKeyboardOpen(enabled = true): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setOpen(false);
      return;
    }

    let cancelled = false;
    const set = (value: boolean) => {
      if (!cancelled) setOpen(value);
    };

    const syncFromFocus = () => {
      // Fallback for web / when native listeners aren't available
      if (!Capacitor.isNativePlatform()) {
        set(isTextFieldFocused() && measureKeyboardInset() > 0);
      } else if (!isTextFieldFocused()) {
        set(false);
      }
    };

    document.addEventListener("focusin", syncFromFocus);
    document.addEventListener("focusout", syncFromFocus);

    const removals: Array<() => void> = [];

    if (Capacitor.isNativePlatform()) {
      const attach = (
        event:
          | "keyboardWillShow"
          | "keyboardDidShow"
          | "keyboardWillHide"
          | "keyboardDidHide",
        value: boolean
      ) => {
        Keyboard.addListener(event, () => set(value)).then((handle) => {
          if (cancelled) {
            handle.remove();
            return;
          }
          removals.push(() => {
            handle.remove();
          });
        });
      };

      attach("keyboardWillShow", true);
      attach("keyboardDidShow", true);
      attach("keyboardWillHide", false);
      attach("keyboardDidHide", false);
    } else {
      const vv = window.visualViewport;
      vv?.addEventListener("resize", syncFromFocus);
      window.addEventListener("resize", syncFromFocus);
      removals.push(() => {
        vv?.removeEventListener("resize", syncFromFocus);
        window.removeEventListener("resize", syncFromFocus);
      });
      syncFromFocus();
    }

    return () => {
      cancelled = true;
      document.removeEventListener("focusin", syncFromFocus);
      document.removeEventListener("focusout", syncFromFocus);
      removals.forEach((remove) => remove());
      setOpen(false);
    };
  }, [enabled]);

  return open;
}
