"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Global error boundary: shows a generic message to the user — never the
// error itself (which may contain stack traces or internal details).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for debugging; only the digest (an opaque ID) is safe to reference.
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md">
        An unexpected error occurred. Please try again — if the problem
        persists, contact support{error?.digest ? ` and mention error ID ${error.digest}` : ""}.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
