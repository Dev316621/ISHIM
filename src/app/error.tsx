"use client";

import { useEffect } from "react";
import { Home, RotateCcw, TriangleAlert } from "lucide-react";

/**
 * Branded route-level error boundary (matches the 404 page's look).
 * Catches render/data errors inside the app shell and offers a real
 * recovery path: "Try again" re-renders the segment in place, "Go Home"
 * restarts the session from the top. The Next.js digest (when present)
 * is shown so a user can quote it when reporting a problem.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Surface the technical detail in the console for support, keep the UI calm.
  useEffect(() => {
    console.error("[ishim] route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-sm">
        <div
          aria-hidden
          className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"
        >
          <TriangleAlert className="size-7" />
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We hit an unexpected snag loading this part of iShim. Trying again
          usually fixes it — your data is safe.
        </p>

        {error?.digest ? (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] sm:w-auto"
          >
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-6 text-sm font-medium text-foreground/80 transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] sm:w-auto"
          >
            <Home className="size-4" aria-hidden />
            Go Home
          </a>
        </div>
      </div>
    </main>
  );
}
