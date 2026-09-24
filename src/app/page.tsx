"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { NavBar, MobileTopBar } from "@/components/ishim/nav-bar";
import { BottomNav } from "@/components/ishim/bottom-nav";
import { Footer } from "@/components/ishim/footer";
import { HomeView } from "@/components/ishim/home-view";
import { SearchView } from "@/components/ishim/search-view";
import { DetailView } from "@/components/ishim/detail-view";
import { DirectoryView } from "@/components/ishim/directory-view";
import { PricingView } from "@/components/ishim/pricing-view";
import { ProfileView } from "@/components/ishim/profile-view";
import { AuthSheet } from "@/components/ishim/auth-sheet";
import { ListingFormDialog } from "@/components/ishim/listing-form-dialog";
import { QuickListDialog } from "@/components/ishim/quick-list-dialog";
import { ImpersonationPill } from "@/components/ishim/impersonation-pill";
import { HelpWidget } from "@/components/ishim/help-widget";
import { OmniSearchOverlay } from "@/components/ishim/omni-search";
import { useStore } from "@/lib/store";
import { authApi, clientApi, paymentsApi, publicApi } from "@/lib/api";
import { setSessionToken } from "@/lib/session";
import { toastInfo, toastSuccess } from "@/lib/feedback";
import type { ListingMode } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Full-screen gradient sweep that plays whenever the site vertical flips
 * (iShim ⇄ iShim Business) — emerald for homes, amber for business. Keyed by
 * mode so the mount animation replays on every flip.
 */
function ModeSweep({ mode }: { mode: ListingMode }) {
  return (
    <motion.div
      key={mode}
      initial={{ x: "-110%" }}
      animate={{ x: "110%" }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-y-0 left-0 z-[70] w-[130vw]",
        mode === "BUSINESS"
          ? "bg-gradient-to-r from-transparent via-amber-400/30 to-transparent"
          : "bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent"
      )}
    />
  );
}

/** Soft ambient glow at the top of the page, tinted by the active vertical. */
function ModeGlow({ mode }: { mode: ListingMode }) {
  return (
    <motion.div
      aria-hidden
      animate={{
        background:
          mode === "BUSINESS"
            ? "radial-gradient(70% 100% at 50% 0%, rgba(245,158,11,0.12), transparent 70%)"
            : "radial-gradient(70% 100% at 50% 0%, rgba(16,185,129,0.10), transparent 70%)",
      }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[480px]"
    />
  );
}

function Splash() {
  return (
    <div
      className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3"
      role="status"
      aria-label="Loading iShim"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col items-center gap-3"
      >
        { }
        <img src="/brand/icon-192.png" alt="iShim logo" className="size-14 rounded-2xl shadow-sm" />
        <p className="text-lg font-semibold tracking-tight">iShim</p>
        <p className="text-sm text-muted-foreground">Find your home in Ukhrul</p>
        <Loader2 className="mt-2 size-4 animate-spin text-primary/60" aria-hidden />
      </motion.div>
    </div>
  );
}

const VIEW_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: "easeOut" as const },
};

export default function Page({ initialPropertyId }: { initialPropertyId?: string }) {
  const booted = useStore((s) => s.booted);
  const setBooted = useStore((s) => s.setBooted);
  const view = useStore((s) => s.view);
  const propertyId = useStore((s) => s.propertyId);
  const setUser = useStore((s) => s.setUser);
  const setSettings = useStore((s) => s.setSettings);
  const setSavedIds = useStore((s) => s.setSavedIds);
  const setView = useStore((s) => s.setView);
  const user = useStore((s) => s.user);
  const mode = useStore((s) => s.mode);

  // Boot: restore session + settings, hydrate saved homes.
  // Also consumes the 404 page's "Search Properties" hand-off.
  useEffect(() => {
    let alive = true;
    if (initialPropertyId) {
      useStore.getState().openProperty(initialPropertyId);
      try {
        window.history.replaceState(null, "", "/");
      } catch {
        // storage/history unavailable — skip
      }
    }
    try {
      if (sessionStorage.getItem("ishim.nav.search") === "1") {
        sessionStorage.removeItem("ishim.nav.search");
        if (useStore.getState().view === "home") setView("search");
      }
    } catch {
      // storage unavailable — skip
    }
    (async () => {
      try {
        const [meRes, settings] = await Promise.all([
          authApi.me(),
          publicApi.getSettings().catch(() => null),
        ]);
        if (!alive) return;
        // Adopt (or drop) the header-channel token to match the session.
        if (meRes.user && meRes.token) setSessionToken(meRes.token);
        if (!meRes.user) setSessionToken(null);
        setUser(meRes.user);
        if (settings) setSettings(settings);
        if (meRes.user) {
          const saved = await clientApi.getSaved().catch(() => [] as never[]);
          if (!alive) return;
          setSavedIds(saved.map((p) => p.id));
        }
      } finally {
        if (alive) setBooted(true);
      }
    })();

    // Cashfree return_url hand-off: after a UPI-app redirect the URL carries
    // ?cfPaid=<order_id> — confirm with the gateway (which also fulfils the
    // listing) and strip the param so refreshes don't re-check.
    void (async () => {
      try {
        const u = new URL(window.location.href);
        const cfPaid = u.searchParams.get("cfPaid");
        if (cfPaid) {
          u.searchParams.delete("cfPaid");
          window.history.replaceState(
            null,
            "",
            u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : "")
          );
          const res = await paymentsApi
            .status(cfPaid)
            .catch(() => ({ status: "PENDING" as const }));
          if (res.status === "PAID") {
            toastSuccess("Payment received — thank you!", "Your listing is now closed as Rented.");
            useStore.getState().bumpListings();
          } else if (res.status !== "MISSING") {
            toastInfo(
              "Payment pending",
              "We haven't received a confirmation yet — the listing updates the moment it clears."
            );
          }
        }
      } catch {
        // best-effort only
      }
    })();
    return () => {
      alive = false;
    };
  }, [setBooted, setUser, setSettings, setSavedIds, setView, initialPropertyId]);

  // Hydrate saved ids whenever the signed-in user changes. Guests keep
  // their device-local saves (hydrated from localStorage by the store) —
  // only signed-in staff/legacy users fetch the server list.
  useEffect(() => {
    if (!user) return;
    clientApi
      .getSaved()
      .then((list) => setSavedIds(list.map((p) => p.id)))
      .catch(() => {
        // silent — hearts simply stay unfilled
      });
  }, [user, setSavedIds]);

  // Scroll to top on view change (app-like feel).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [view, propertyId]);

  // Global hotkeys: ⌘K / Ctrl+K anywhere, or "/" outside a field, opens
  // the universal (Google-style) search overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (
        (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && !typing)
      ) {
        e.preventDefault();
        useStore.getState().setOmniOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <ModeGlow mode={mode} />
      <ModeSweep mode={mode} />
      <MobileTopBar />
      <NavBar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10 md:pt-8">
        {!booted ? (
          <Splash />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {view === "home" ? (
              <motion.div key="home" {...VIEW_MOTION}>
                <HomeView />
              </motion.div>
            ) : view === "search" ? (
              <motion.div key="search" {...VIEW_MOTION}>
                <SearchView />
              </motion.div>
            ) : view === "detail" ? (
              <motion.div key={`detail-${propertyId ?? "none"}`} {...VIEW_MOTION}>
                <DetailView />
              </motion.div>
            ) : view === "directory" ? (
              <motion.div key="directory" {...VIEW_MOTION}>
                <DirectoryView />
              </motion.div>
            ) : view === "pricing" ? (
              <motion.div key="pricing" {...VIEW_MOTION}>
                <PricingView />
              </motion.div>
            ) : (
              <motion.div key="profile" {...VIEW_MOTION}>
                <ProfileView />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      <div className="relative z-10 pb-16 md:pb-0">
        <Footer />
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />

      {/* Global dialogs */}
      <OmniSearchOverlay />
      <AuthSheet />
      <ListingFormDialog />
      <QuickListDialog />
      <ImpersonationPill />

      {/* Floating draggable help ("?") widget */}
      <HelpWidget />
    </div>
  );
}
