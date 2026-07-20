"use client";

import Link from "next/link";
import { ReactNode } from "react";

export function LegalPageShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="container mx-auto max-w-3xl px-4 py-10 pb-28">
        <div className="mb-8 space-y-2">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Grace Music
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-zinc-500">Last updated: {updated}</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-300 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_a]:text-sky-400 [&_a]:underline">
          {children}
        </div>

        <div className="mt-10 flex flex-wrap gap-4 border-t border-white/10 pt-6 text-sm">
          <Link href="/privacy" className="text-sky-400 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-sky-400 hover:underline">
            Terms of Service
          </Link>
          <Link href="/about" className="text-zinc-400 hover:text-white">
            About
          </Link>
          <Link href="/login" className="text-zinc-400 hover:text-white">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
