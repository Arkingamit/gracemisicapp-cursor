"use client";

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
 * granted notification permission. Tapping Enable opens the system dialog.
 */
export default function NativePushPermissionPrompt({
  enabled,
}: {
  enabled: boolean;
}) {
  const [permission, setPermission] = useState<NativePushPermission | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !enabled) {
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
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return;
    const timer = window.setTimeout(() => {
      refresh().catch(console.error);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [enabled, refresh]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const handleEnable = async () => {
    setBusy(true);
    try {
      if (permission === "denied") {
        await openNativeNotificationSettings();
        return;
      }
      const result = await initNativePushNotifications(true);
      setPermission(result === "granted" ? "granted" : result === "denied" ? "denied" : "prompt");
      if (result === "granted") {
        setVisible(false);
      } else if (result === "denied") {
        // User denied the system dialog — offer settings on next tap
        setPermission("denied");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  const denied = permission === "denied";

  return (
    <div className="fixed inset-x-3 bottom-24 z-[80] sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2">
      <div className="rounded-2xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md">
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
                onClick={handleEnable}
              >
                {denied ? "Open Settings" : "Allow"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-zinc-400 hover:text-white"
                disabled={busy}
                onClick={dismiss}
              >
                Not now
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
