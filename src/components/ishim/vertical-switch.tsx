"use client";

import { House, Store } from "lucide-react";
import { motion } from "framer-motion";

import type { ListingMode } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const MODE_META: Record<
  ListingMode,
  { label: string; brand: string; sub: string; icon: typeof House }
> = {
  HOME: {
    label: "iShim",
    brand: "Homes",
    sub: "Houses & apartments",
    icon: House,
  },
  BUSINESS: {
    label: "iShim Business",
    brand: "Business",
    sub: "Shops, offices, cafes",
    icon: Store,
  },
};

const SPRING = { type: "spring" as const, stiffness: 420, damping: 34 };

/**
 * Animated vertical segmented control — one sliding pill (layoutId) glides
 * between the two panels with a spring, plus a per-vertical glow. Used by the
 * footer site switcher and the iShim ⇄ iShim Business discretion switchers in
 * the admin / owner / agent dashboards.
 */
export function VerticalSwitch({
  value,
  onChange,
  size = "md",
  counts,
  className,
  label = "Site mode",
}: {
  value: ListingMode;
  onChange: (m: ListingMode) => void;
  /** md = dashboards · lg = footer hero switcher */
  size?: "sm" | "md" | "lg";
  /** Optional live counts rendered under each label. */
  counts?: Partial<Record<ListingMode, number>>;
  className?: string;
  /** Accessible group label. */
  label?: string;
}) {
  const big = size === "lg";
  const mid = size === "md";
  const t = useT();
  const brandKeys = { HOME: "vert.homes.brand", BUSINESS: "vert.business.brand" } as const;
  const subKeys = { HOME: "vert.homes.sub", BUSINESS: "vert.business.sub" } as const;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative grid w-full grid-cols-2 gap-1 rounded-2xl border border-border/70 bg-background p-1 shadow-sm",
        big ? "max-w-sm" : "max-w-md",
        className
      )}
    >
      {(Object.keys(MODE_META) as ListingMode[]).map((key) => {
        const active = value === key;
        const meta = MODE_META[key];
        const Icon = meta.icon;
        const count = counts?.[key];
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            className={cn(
              "relative flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              big ? "min-h-14 flex-col py-2 sm:flex-row" : mid ? "py-1.5" : "py-1",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active ? (
              <motion.span
                layoutId={`vertical-pill-${size}`}
                transition={SPRING}
                className={cn(
                  "absolute inset-0 rounded-xl shadow-md",
                  key === "HOME"
                    ? "bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-emerald-600/25"
                    : "bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/25"
                )}
                aria-hidden
              />
            ) : null}
            <motion.span
              aria-hidden
              animate={active ? { scale: [1, 1.18, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="relative z-10 flex"
            >
              <Icon className={cn(big ? "size-5" : "size-4")} />
            </motion.span>
            <span className="relative z-10 min-w-0 leading-tight">
              <span
                className={cn(
                  "block truncate font-semibold",
                  big ? "text-sm sm:text-base" : mid ? "text-sm" : "text-xs"
                )}
              >
                {big ? meta.label : t(brandKeys[key])}
              </span>
              {big ? (
                <span
                  className={cn(
                    "block text-[11px] font-normal",
                    active ? "text-primary-foreground/85" : "text-muted-foreground"
                  )}
                >
                  {t(subKeys[key])}
                </span>
              ) : null}
              {count !== undefined ? (
                <span
                  className={cn(
                    "block text-[10px] font-medium",
                    active ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {count.toLocaleString("en-IN")} {count === 1 ? "listing" : "listings"}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
