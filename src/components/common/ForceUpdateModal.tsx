"use client";

import React, { useState } from 'react';
import { useAppVersionCheck, UpdateStatus } from '@/hooks/useAppVersionCheck';
import { ArrowUpCircle, Download, Smartphone, X } from 'lucide-react';

/**
 * ForceUpdateModal — Shown to mobile (Capacitor) users when an app update is needed.
 * 
 * Two modes:
 * - Force Update: Full-screen blocking overlay, cannot be dismissed
 * - Optional Update: Dismissable dialog with "Update Now" and "Later" buttons
 */
export default function ForceUpdateModal() {
  const { status, updateUrl, message, latestVersion } = useAppVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  // Don't render anything if app is up to date, still checking, or optional was dismissed
  if (status === 'ok' || status === 'checking' || status === 'error') return null;
  if (status === 'optional_update' && dismissed) return null;

  const handleUpdate = () => {
    if (updateUrl) {
      window.open(updateUrl, '_system');
    }
  };

  // ── Force Update (full-screen blocking) ──
  if (status === 'force_update') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-xl">
        <div className="flex flex-col items-center justify-center px-8 text-center max-w-md mx-auto">
          {/* Animated icon */}
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-3xl bg-zinc-800 border border-white/10 flex items-center justify-center shadow-2xl animate-pulse">
              <ArrowUpCircle className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 border-2 border-black flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">!</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-3">
            Update Required
          </h1>

          {/* Version badge */}
          {latestVersion && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-5">
              <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-300">
                Version {latestVersion} available
              </span>
            </div>
          )}

          {/* Message */}
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            {message}
          </p>

          {/* Update button */}
          <button
            onClick={handleUpdate}
            disabled={!updateUrl}
            className="w-full max-w-xs flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 border border-white/15 text-white font-semibold text-base shadow-xl hover:bg-white/15 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            Update Now
          </button>

          {!updateUrl && (
            <p className="text-xs text-zinc-600 mt-4">
              Store link not configured. Please contact support.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Optional Update (dismissable dialog) ──
  if (status === 'optional_update') {
    return (
      <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm mx-4 mb-6 sm:mb-0 bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="relative p-6 pb-4">
            <button
              onClick={() => setDismissed(true)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <ArrowUpCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Update Available</h2>
                {latestVersion && (
                  <p className="text-xs text-zinc-500">Version {latestVersion}</p>
                )}
              </div>
            </div>

            <p className="text-sm text-zinc-400 leading-relaxed">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={() => setDismissed(true)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-zinc-300 hover:bg-white/10 transition-colors"
            >
              Later
            </button>
            <button
              onClick={handleUpdate}
              disabled={!updateUrl}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Update
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
