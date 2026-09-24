"use client";

import { ArrowRight, Building2, IndianRupee, Users } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { VerticalSwitch } from "./vertical-switch";
import { cn } from "@/lib/utils";

/**
 * Footer vertical switcher — flips the whole site between residential
 * ("iShim") and commercial ("iShim Business" — shops, offices, cafes…).
 * Owners, agents and admins use the same dashboards for both; only the
 * listings, filters and pricing (admin-set per vertical) change.
 */
export function Footer() {
  const setView = useStore((s) => s.setView);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const t = useT();
  const business = mode === "BUSINESS";

  return (
    <footer className="mt-auto overflow-hidden border-t border-border/60 bg-secondary/50">
      <div className="mx-auto max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+5.75rem)] pt-8 sm:px-6 md:pb-10">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
          <div>
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <img
                src="/brand/icon-48.png"
                alt=""
                aria-hidden
                className="size-6 rounded-md"
              />
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={mode}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="font-semibold tracking-tight"
                >
                  {business ? "iShim Business" : "iShim"}
                </motion.p>
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={`tag-${mode}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, delay: 0.04 }}
                className="text-sm text-muted-foreground"
              >
                {business
                  ? t("footer.tagline.business")
                  : t("footer.tagline.homes")}
              </motion.p>
            </AnimatePresence>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-medium sm:justify-start">
              <Building2 className="size-4 text-primary" aria-hidden />
              iShim by eX Holdings
            </p>
          </div>
          <div className="flex flex-col items-center gap-4 sm:items-end">
            {/* iShim ⇄ iShim Business switcher */}
            <div className="flex w-full flex-col items-center gap-1.5 sm:w-auto sm:items-end">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("footer.browsing")}
              </p>
              <VerticalSwitch
                value={mode}
                onChange={setMode}
                size="lg"
                label="Site mode — homes or business"
                className="sm:w-80"
              />
            </div>
            <div className="flex flex-col items-center gap-1.5 sm:items-end">
              <button
                type="button"
                onClick={() => setView("pricing")}
                className="group inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background px-4 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-secondary hover:shadow"
              >
                <IndianRupee className="size-4" aria-hidden />
                {t("footer.pricing")}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
              <p className="text-xs text-muted-foreground">
                36 months free — simple fees after.
              </p>
            </div>
            <div className="flex flex-col items-center gap-1.5 sm:items-end">
              <button
                type="button"
                onClick={() => setView("directory")}
                className="group inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background px-4 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-secondary hover:shadow"
              >
                <Users className="size-4" aria-hidden />
                {t("footer.owners")}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
              <p className="text-xs text-muted-foreground">
                Every registered owner &amp; agent — contacts and listings.
              </p>
            </div>
          </div>
        </div>
        <p
          className={cn(
            "mt-6 text-center text-xs text-muted-foreground sm:text-left"
          )}
        >
          © 2026 eX Holdings. All rights reserved. · Developed by eX.
        </p>
      </div>
    </footer>
  );
}
