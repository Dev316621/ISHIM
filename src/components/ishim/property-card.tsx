"use client";

import { useCallback } from "react";
import {
  BadgeCheck,
  Bath,
  BedDouble,
  HandCoins,
  Heart,
  House,
  MapPin,
  Ruler,
  Star,
  Store,
} from "lucide-react";
import { Photo } from "./photo";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { clientApi } from "@/lib/api";
import { toastSuccess } from "@/lib/feedback";
import { formatRent, typeLabel, type Property } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Listing card — informational only (photo, price, status, save).
 * All contact actions (WhatsApp / Call / Inquire / Book) live INSIDE the
 * property detail page, where the client also picks owner vs agent.
 */
export function PropertyCard({
  property,
  className,
  showMode,
}: {
  property: Property;
  className?: string;
  /** Show a small Home/Business chip (used when results mix both verticals). */
  showMode?: boolean;
}) {
  const savedIds = useStore((s) => s.savedIds);
  const toggleSavedLocal = useStore((s) => s.toggleSavedLocal);
  const t = useT();
  const user = useStore((s) => s.user);
  const openProperty = useStore((s) => s.openProperty);

  const photo = property.photos?.[0];
  const saved = savedIds.includes(property.id);
  const rented = property.status === "RENTED";

  /**
   * One-tap save, no sign-in ever: guests persist the heart on their
   * device (localStorage via the store); signed-in staff/legacy users
   * additionally sync to the server.
   */
  const onToggleSave = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      const nextSaved = !savedIds.includes(property.id);
      toggleSavedLocal(property.id, nextSaved);
      toastSuccess(nextSaved ? "Saved to your homes" : "Removed from saved");
      if (user) {
        try {
          await clientApi.toggleSaved(property.id);
        } catch {
          // keep the optimistic local state — it's the source of truth
        }
      }
    },
    [property.id, savedIds, user, toggleSavedLocal]
  );

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${property.title} in ${property.block}, ${formatRent(property.rent)} per month${rented ? ", currently rented" : ", available now"}`}
      onClick={() => openProperty(property.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openProperty(property.id);
        }
      }}
      className={cn(
        "group cursor-pointer overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Photo
          src={photo}
          alt={property.title}
          className={cn(
            "h-full w-full transition-transform duration-500 ease-out group-hover:scale-105",
            rented && "opacity-75 saturate-50"
          )}
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-foreground shadow-sm backdrop-blur">
          {formatRent(property.rent)}
          <span className="font-normal text-muted-foreground">/mo</span>
        </span>
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {property.featured ? (
            <Badge className="gap-1 rounded-full bg-primary/90 text-primary-foreground">
              <Star className="size-3 fill-current" aria-hidden />
              {t("card.featured")}
            </Badge>
          ) : null}
          {showMode ? (
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm backdrop-blur",
                property.mode === "BUSINESS" ? "bg-amber-500/90" : "bg-primary/90"
              )}
            >
              {property.mode === "BUSINESS" ? (
                <Store className="size-3" aria-hidden />
              ) : (
                <House className="size-3" aria-hidden />
              )}
              {property.mode === "BUSINESS" ? t("card.mode.business") : t("card.mode.home")}
            </span>
          ) : null}
        </div>
        {rented ? (
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <span className="size-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
            {t("card.rented")}
          </span>
        ) : (
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
            {t("card.available")}
          </span>
        )}
        <button
          type="button"
          aria-label={saved ? t("card.unsave") : t("card.save")}
          aria-pressed={saved}
          onClick={onToggleSave}
          className={cn(
            "absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-white/85 shadow-sm backdrop-blur transition-all hover:bg-white hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-9",
            saved && "bg-white"
          )}
        >
          <Heart
            className={cn(
              "size-4.5 transition-colors",
              saved ? "fill-primary text-primary" : "text-foreground/70"
            )}
            aria-hidden
          />
        </button>
      </div>

      <div className="space-y-2 p-4">
        <p className="line-clamp-1 font-medium">{property.title}</p>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{property.block}</span>
          {property.owner?.verified ? (
            <BadgeCheck
              className="size-4 shrink-0 text-primary"
              aria-label="Verified owner"
            />
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{typeLabel(property)}</span>
          {property.mode === "BUSINESS" ? (
            property.areaSqft ? (
              <span className="flex items-center gap-1 tabular-nums">
                <Ruler className="size-3.5" aria-hidden />
                {property.areaSqft.toLocaleString("en-IN")} sq ft
              </span>
            ) : null
          ) : (
            <>
              <span className="flex items-center gap-1">
                <BedDouble className="size-3.5" aria-hidden />
                {property.bedrooms}
              </span>
              <span className="flex items-center gap-1">
                <Bath className="size-3.5" aria-hidden />
                {property.bathrooms}
              </span>
            </>
          )}
          {property.negotiable ? (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
              <HandCoins className="size-3" aria-hidden />
              {t("card.negotiable")}
            </span>
          ) : null}
        </div>

        {property.status === "RENTED" ? (
          <p className="pt-1 text-xs text-muted-foreground">
            {t("card.rentedNote")}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function PropertyCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card", className)}>
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="space-y-2.5 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}
