"use client";

import { useEffect, useState } from "react";

import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

const KEYBOARD_MIN_PX = 120;
/** Layout vs visual viewport match → window already resized (no manual inset). */
const RESIZED_MATCH_PX = 48;

function isTextFieldFocused(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || !!el.isContentEditable;
}

/** Undo residual WebView scroll/offset after the keyboard dismisses. */
function resetViewportAfterKeyboard() {
  if (typeof window === "undefined") return;
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export type VisualViewportBox = {
  top: number;
  height: number;
};

/**
 * Pin fixed full-screen panels to the Visual Viewport.
 * On iOS the keyboard often pans via visualViewport instead of resizing layout.
 * Binding top/height to VV keeps composers above the keyboard.
 *
 * @param lockDocumentScroll When true, resets window scroll (chat overlays only).
 *   Do NOT enable for dialogs — it freezes page scroll and can leave a black overlay.
 */
export function useVisualViewportBox(
  enabled = true,
  lockDocumentScroll = false
): VisualViewportBox {
  const [box, setBox] = useState<VisualViewportBox>(() => ({
    top: 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  }));

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setBox({
        top: 0,
        height: typeof window !== "undefined" ? window.innerHeight : 0,
      });
      return;
    }

    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      const vv = window.visualViewport;
      if (!vv) {
        setBox({ top: 0, height: window.innerHeight });
        return;
      }
      setBox({
        top: Math.max(0, Math.round(vv.offsetTop)),
        height: Math.max(0, Math.round(vv.height)),
      });
    };

    sync();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);

    const onFocusOrScroll = () => {
      if (lockDocumentScroll) {
        if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) {
          window.scrollTo(0, 0);
        }
      }
      sync();
    };

    if (lockDocumentScroll) {
      document.addEventListener("focusin", onFocusOrScroll);
      window.addEventListener("scroll", onFocusOrScroll, { passive: true });
    }

    return () => {
      cancelled = true;
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      if (lockDocumentScroll) {
        document.removeEventListener("focusin", onFocusOrScroll);
        window.removeEventListener("scroll", onFocusOrScroll);
      }
    };
  }, [enabled, lockDocumentScroll]);

  return box;
}

/**
 * Measure soft-keyboard overlap via VisualViewport (iOS / mobile web).
 * Android Capacitor returns 0 — use useVisualViewportBox for panels instead.
 */
export function measureKeyboardInset(): number {
  if (typeof window === "undefined") return 0;

  if (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android"
  ) {
    return 0;
  }

  const vv = window.visualViewport;
  if (!vv) return 0;
  if (!isTextFieldFocused()) return 0;

  const clientH = document.documentElement.clientHeight;
  if (Math.abs(clientH - vv.height) <= RESIZED_MATCH_PX) {
    return 0;
  }

  const inset = Math.max(
    0,
    Math.round(window.innerHeight - vv.height - vv.offsetTop)
  );
  return inset >= KEYBOARD_MIN_PX ? inset : 0;
}

/**
 * Extra bottom inset for fixed panels (iOS overlay keyboard).
 * Always 0 on Capacitor Android — panels should use useVisualViewportBox.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setInset(0);
      return;
    }

    if (
      Capacitor.isNativePlatform() &&
      Capacitor.getPlatform() === "android"
    ) {
      setInset(0);
      return;
    }

    let cancelled = false;
    let nativeHeight = 0;
    const isIos = Capacitor.getPlatform() === "ios";

    const update = () => {
      if (cancelled) return;
      const vvInset = measureKeyboardInset();
      if (isIos && nativeHeight >= KEYBOARD_MIN_PX) {
        setInset(Math.max(vvInset, nativeHeight));
        return;
      }
      setInset(vvInset);
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
      const onShow = (info: { keyboardHeight?: number }) => {
        nativeHeight = info?.keyboardHeight ?? nativeHeight;
        update();
      };
      const onHide = () => {
        nativeHeight = 0;
        if (!cancelled) setInset(0);
      };

      Keyboard.addListener("keyboardWillShow", onShow).then((handle) => {
        if (cancelled) handle.remove();
        else removals.push(() => handle.remove());
      });
      Keyboard.addListener("keyboardDidShow", onShow).then((handle) => {
        if (cancelled) handle.remove();
        else removals.push(() => handle.remove());
      });
      Keyboard.addListener("keyboardWillHide", onHide).then((handle) => {
        if (cancelled) handle.remove();
        else removals.push(() => handle.remove());
      });
      Keyboard.addListener("keyboardDidHide", () => {
        onHide();
        resetViewportAfterKeyboard();
      }).then((handle) => {
        if (cancelled) handle.remove();
        else removals.push(() => handle.remove());
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
      if (!Capacitor.isNativePlatform()) {
        const vv = window.visualViewport;
        const shrunk =
          !!vv && window.innerHeight - vv.height - vv.offsetTop >= KEYBOARD_MIN_PX;
        set(isTextFieldFocused() && shrunk);
      } else if (!isTextFieldFocused()) {
        set(false);
      }
    };

    document.addEventListener("focusin", syncFromFocus);
    document.addEventListener("focusout", syncFromFocus);

    const removals: Array<() => void> = [];

    if (Capacitor.isNativePlatform()) {
      const track = (p: Promise<{ remove: () => void }>) => {
        p.then((handle) => {
          if (cancelled) handle.remove();
          else removals.push(() => handle.remove());
        });
      };

      track(Keyboard.addListener("keyboardWillShow", () => set(true)));
      track(Keyboard.addListener("keyboardDidShow", () => set(true)));
      track(Keyboard.addListener("keyboardWillHide", () => set(false)));
      track(
        Keyboard.addListener("keyboardDidHide", () => {
          set(false);
          resetViewportAfterKeyboard();
        })
      );
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
