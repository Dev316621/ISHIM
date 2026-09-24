"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PanelTab = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Optional attention badge (e.g. count of new listing requests). */
  badge?: number;
};

/**
 * Mobile section switcher for the admin / agent panels.
 *
 * A grid of large icon tiles replaces the horizontally-scrolling tab strip
 * (which pushed tabs off-screen on phones and made the active tab easy to
 * lose). Each tile is a comfortable 44px+ touch target. Desktop keeps the
 * pill TabsList rendered by the panel itself (hidden below `sm`).
 */
export function PanelTabGrid({
  tabs,
  value,
  onChange,
}: {
  tabs: PanelTab[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Panel sections" className="grid grid-cols-3 gap-2 sm:hidden">
      {tabs.map((t) => {
        const active = t.key === value;
        const Icon = t.icon;
        return (
          <motion.button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 text-xs font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            <span className="relative">
              <Icon className="size-5" aria-hidden />
              {typeof t.badge === "number" && t.badge > 0 ? (
                <span
                  aria-hidden
                  className="absolute -right-2.5 -top-2 flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 py-px text-[10px] font-bold leading-none text-white ring-2 ring-card"
                >
                  {t.badge > 9 ? "9+" : t.badge}
                </span>
              ) : null}
            </span>
            <span>{t.label}</span>
            {typeof t.badge === "number" && t.badge > 0 ? (
              <span className="sr-only">, {t.badge} waiting</span>
            ) : null}
          </motion.button>
        );
      })}
    </div>
  );
}
