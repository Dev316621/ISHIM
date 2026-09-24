"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE, type PropertyStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status?: PropertyStatus | string | null;
  className?: string;
}) {
  if (!status) return null;
  const cfg = STATUS_BADGE[status as PropertyStatus];
  if (!cfg) return null;
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full font-medium", cfg.className, className)}
    >
      {cfg.label}
    </Badge>
  );
}
