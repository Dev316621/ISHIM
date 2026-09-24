"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary — the last line of defence when the root
 * layout itself fails. It renders its own <html>/<body> (the app shell is
 * unavailable) with inline styles only, mirroring the 404 page's palette
 * so even a catastrophic failure still feels like iShim.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ishim] global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(ellipse at top, rgba(16,44,32,0.55), rgba(4,7,6,1) 62%), #04070a",
          color: "#fff",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p
            aria-hidden
            style={{
              fontSize: 40,
              lineHeight: 1,
              margin: 0,
              opacity: 0.9,
            }}
          >
            ⌂
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "16px 0 8px" }}>
            iShim hit a snag
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.6)",
              margin: "0 0 8px",
            }}
          >
            Something failed at the app&rsquo;s foundation. Reloading usually
            brings everything back.
          </p>
          {error?.digest ? (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                color: "rgba(255,255,255,0.35)",
                margin: "0 0 20px",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : (
            <div style={{ height: 20 }} />
          )}
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: 44,
                padding: "0 24px",
                borderRadius: 12,
                border: "none",
                background: "#17603e",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                minHeight: 44,
                padding: "0 24px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.75)",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Go Home
            </a>
          </div>
          <p
            style={{
              marginTop: 40,
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.25)",
            }}
          >
            iShim · Find · Rent · Belong
          </p>
        </div>
      </body>
    </html>
  );
}
