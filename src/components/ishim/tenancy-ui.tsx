"use client";

import { DoorOpen, Star } from "lucide-react";
import type { TenancyStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Occupancy pill — "Living here" (green) / "Moved out" (muted). */
export function TenancyStatusPill({
  status,
  className,
}: {
  status: TenancyStatus;
  className?: string;
}) {
  if (status === "STAYING") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary",
          className
        )}
      >
        <span className="size-1.5 rounded-full bg-primary" aria-hidden />
        Living here
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      <DoorOpen className="size-3" aria-hidden />
      Moved out
    </span>
  );
}

/** Read-only star row (amber fill), for review displays. */
export function StarsDisplay({
  value,
  className,
  size = "size-3.5",
}: {
  value: number;
  className?: string;
  size?: string;
}) {
  const rounded = Math.round(value);
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn(
            size,
            n <= rounded ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/30"
          )}
        />
      ))}
    </span>
  );
}
