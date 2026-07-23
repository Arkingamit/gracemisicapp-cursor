"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getNativePushPermission,
  initNativePushNotifications,
  openNativeNotificationSettings,
  type NativePushPermission,
} from "@/lib/nativePushNotifications";

const DISMISS_KEY = "grace_push_prompt_dismissed_at";
const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Shown on Capacitor Android/iOS when the user is logged in but has not
 * granted notification permission. Tapping Allow opens the system dialog.
 *
 * Portaled to document.body above Radix dialogs (e.g. profile setup) so the
 * Allow button remains tappable.
 */
export default function NativePushPermissionPrompt({
  enabled,
}: {
  enabled: boolean;
}) {
  const { currentUser } = useAuth();
  const [permission, setPermission] = useState<NativePushPermission | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Wait until profile setup is done — that modal's overlay was eating Allow taps
  const profileReady = !!(
    currentUser?.church?.trim() && currentUser?.instrument?.trim()
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !enabled || !profileReady) {
      setVisible(false);
      return;
    }
    const status = await getNativePushPermission();
    setPermission(status);
    if (status === "granted") {
      setVisible(false);
      return;
    }
    if (wasRecentlyDismissed()) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [enabled, profileReady]);

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform() || !profileReady) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => {
      refresh().catch(console.error);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [enabled, profileReady, refresh]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (permission === "denied") {
        await openNativeNotificationSettings();
        return;
      }
      const result = await initNativePushNotifications(true);
      if (result === "granted") {
        setPermission("granted");
        setVisible(false);
      } else {
        setPermission("denied");
      }
    } catch (err) {
      console.error("[Grace] Allow notifications failed:", err);
    } finally {
      setBusy(false);
    }
  };

  if (!mounted || !visible) return null;

  const denied = permission === "denied";

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex justify-center px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-8"
      role="dialog"
      aria-label="Turn on notifications"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
            <Bell className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Turn on notifications</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              {denied
                ? "Notifications are blocked. Open settings and allow Grace Music to send alerts for sets and updates."
                : "Allow Grace Music to send you alerts for song sets, groups, and important updates."}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-sky-500 text-white hover:bg-sky-400"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleEnable();
                }}
              >
                {busy ? "Please wait…" : denied ? "Open Settings" : "Allow"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-zinc-400 hover:text-white"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dismiss();
                }}
              >
                Not now
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dismiss();
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
