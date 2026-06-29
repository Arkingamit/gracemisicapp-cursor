"use client";
import { Suspense } from "react";
import Login from "@/views/Login";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent flex items-center justify-center text-zinc-500">Loading...</div>}>
      <Login />
    </Suspense>
  );
}

