"use client";

import { useEffect, useState } from "react";

import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

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
  if (!isTextFieldFocused()) return 0;
  const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  return inset >= KEYBOARD_MIN_PX ? inset : 0;
}

/**
 * Tracks keyboard overlap for fixed full-screen chat panels.
 * Uses Capacitor native Keyboard plugin if on mobile, otherwise falls back to VisualViewport.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setInset(0);
      return;
    }

    if (Capacitor.isNativePlatform()) {
      let isMounted = true;
      const showListener = Keyboard.addListener('keyboardWillShow', info => {
        if (isMounted) setInset(info.keyboardHeight);
      });
      const hideListener = Keyboard.addListener('keyboardWillHide', () => {
        if (isMounted) setInset(0);
      });

      return () => {
        isMounted = false;
        showListener.then(l => l.remove());
        hideListener.then(l => l.remove());
        setInset(0);
      };
    } else {
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
    }
  }, [enabled]);

  return inset;
}
