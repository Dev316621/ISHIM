"use client";

import { useState } from "react";
import { House } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Plain <img> with a sage-tinted placeholder fallback when the photo
 * is missing or fails to load (Apple-clean, brand-consistent).
 */
export function Photo({
  src,
  alt,
  className,
  iconClassName,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  if (showFallback) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex items-center justify-center bg-secondary",
          className
        )}
      >
        <House
          className={cn("size-8 text-primary/35", iconClassName)}
          aria-hidden
        />
      </div>
    );
  }

  return (
     
    <img
      src={src as string}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}
