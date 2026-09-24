"use client";

import { Home, Search } from "lucide-react";

/**
 * Branded 404 — built from the iShim "house that moved out" artwork.
 * The art is shown full-width (its baked-in buttons were cropped out);
 * the heading, subtext and both actions below are real, accessible HTML.
 * "Search Properties" jumps home and opens the search view via a
 * sessionStorage hand-off consumed by the app's boot effect.
 */

export default function NotFound() {
  const goSearch = () => {
    try {
      sessionStorage.setItem("ishim.nav.search", "1");
    } catch {
      // private mode — the flag is best-effort, home still works
    }
    window.location.href = "/";
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#04070a] text-white [background-image:radial-gradient(ellipse_at_top,rgba(16,44,32,0.55),rgba(4,7,6,1)_62%)]">
      <h1 className="sr-only">404 — page not found</h1>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-16 pt-6 sm:px-6">
        {/* Artwork (logo, 404 door + lost house, signpost) */}
        <div className="relative w-full select-none" style={{ aspectRatio: "1536 / 730" }}>
          <img
            src="/images/404-art.jpg"
            alt="iShim 404 — a little lost house sits under a signpost reading: this page doesn't exist, but a better home might"
            className="absolute inset-0 h-full w-full rounded-2xl object-cover"
            draggable={false}
          />
        </div>

        {/* Real, crisp copy (mirrors the poster) */}
        <p className="mt-2 text-center text-xl font-semibold tracking-tight text-white/90 md:text-2xl">
          Looks like this page has moved out.
        </p>
        <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-white/55">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have been
          moved. Let&rsquo;s get you back home.
        </p>

        {/* Actions */}
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
          <a
            href="/"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17603e] px-7 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(23,96,62,0.35)] transition-all hover:bg-[#1b7149] hover:shadow-[0_10px_28px_rgba(23,96,62,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.98] sm:w-auto"
          >
            <Home className="size-4" aria-hidden />
            Go Home
          </a>
          <button
            type="button"
            onClick={goSearch}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-7 text-sm font-medium text-white/75 transition-all hover:border-white/30 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.98] sm:w-auto"
          >
            <Search className="size-4" aria-hidden />
            Search Properties
          </button>
        </div>

        <p className="mt-10 text-[11px] uppercase tracking-[0.2em] text-white/25">
          iShim · Find · Rent · Belong
        </p>
      </div>
    </main>
  );
}
