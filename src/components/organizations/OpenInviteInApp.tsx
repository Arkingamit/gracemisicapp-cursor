"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";

/**
 * On mobile browsers, offer opening the invite in the installed Grace Music app.
 * Verified App / Universal Links handle taps from Messages/WhatsApp automatically;
 * this covers the case where the user landed in the browser first.
 */
export default function OpenInviteInApp({ code }: { code: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Capacitor.isNativePlatform()) return;

    const ua = navigator.userAgent || "";
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
    setShow(mobile && !!code);
  }, [code]);

  if (!show) return null;

  const httpsUrl = `https://music.graceahmedabad.org/invite/${encodeURIComponent(code)}`;
  const isAndroid = /Android/i.test(navigator.userAgent || "");

  const openApp = () => {
    if (isAndroid) {
      // Prefer App Link via intent; falls back to Play Store / browser
      const intent =
        `intent://music.graceahmedabad.org/invite/${encodeURIComponent(code)}` +
        `#Intent;scheme=https;package=org.graceahmedabad.music;` +
        `S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`;
      window.location.href = intent;
      return;
    }

    // iOS: custom scheme (Universal Links already tried when the https link was tapped)
    window.location.href = `org.graceahmedabad.music://invite/${encodeURIComponent(code)}`;
  };

  return (
    <div className="fixed inset-x-3 bottom-24 z-[90] sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2">
      <div className="rounded-2xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md">
        <p className="text-sm font-medium text-white">Have the Grace Music app?</p>
        <p className="mt-1 text-xs text-zinc-400">
          Open this invite in the app for the best experience.
        </p>
        <Button
          type="button"
          size="sm"
          className="mt-3 w-full gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
          onClick={openApp}
        >
          <Smartphone className="h-4 w-4" />
          Open in Grace Music app
        </Button>
      </div>
    </div>
  );
}
