"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Bath,
  BedDouble,
  Briefcase,
  CalendarCheck,
  Clock,
  CookingPot,
  Eye,
  HandCoins,
  Heart,
  House,
  MapPin,
  MessageCircle,
  MoveHorizontal,
  Phone,
  Ruler,
  Share2,
  ShieldCheck,
  Star,
  Store,
  Tag,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PhotoCarousel } from "./photo-carousel";
import { EnquiryDialog } from "./enquiry-dialog";
import { RatingDialog } from "./rating-dialog";
import { StarsDisplay, TenancyStatusPill } from "./tenancy-ui";
import { useStore } from "@/lib/store";
import { clientApi, publicApi } from "@/lib/api";
import { toastError, toastInfo, toastSuccess } from "@/lib/feedback";
import {
  BUSINESS_TYPE_LABELS,
  HOUSE_TYPE_LABELS,
  KITCHEN_LABELS,
  formatDate,
  formatRent,
  type EnquiryKind,
  type Property,
  type PropertyReviews,
  type PropertyRatings,
  type RatingTarget,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/** WhatsApp / Call / Inquire / Book — a 2×2 grid that works at every width. */
function EnquiryActions({
  enquiryLabel,
  contacting,
  calling,
  onWhatsApp,
  onCall,
  onEnquiry,
  onVisit,
}: {
  enquiryLabel: string;
  contacting: boolean;
  calling: boolean;
  onWhatsApp: () => void;
  onCall: () => void;
  onEnquiry: () => void;
  onVisit: () => void;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Button
        onClick={onWhatsApp}
        disabled={contacting}
        className="h-12 rounded-full text-sm sm:text-base"
      >
        <MessageCircle aria-hidden />
        {contacting ? "…" : t("detail.whatsapp")}
      </Button>
      <Button
        variant="outline"
        onClick={onCall}
        disabled={calling}
        className="h-12 rounded-full text-sm sm:text-base"
      >
        <Phone aria-hidden />
        {calling ? "…" : t("detail.call")}
      </Button>
      <Button
        variant="secondary"
        onClick={onEnquiry}
        className="h-12 rounded-full text-sm sm:text-base"
      >
        <UserRound aria-hidden />
        {enquiryLabel}
      </Button>
      <Button
        variant="secondary"
        onClick={onVisit}
        className="h-12 rounded-full text-sm sm:text-base"
      >
        <CalendarCheck aria-hidden />
        {t("detail.bookVisit")}
      </Button>
    </div>
  );
}

export function DetailView() {
  const propertyId = useStore((s) => s.propertyId);
  const t = useT();
  const searchFilters = useStore((s) => s.searchFilters);
  const setView = useStore((s) => s.setView);
  const savedIds = useStore((s) => s.savedIds);
  const toggleSavedLocal = useStore((s) => s.toggleSavedLocal);
  const user = useStore((s) => s.user);
  const addRecentContact = useStore((s) => s.addRecentContact);

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);
  const [calling, setCalling] = useState(false);
  const [reviews, setReviews] = useState<PropertyReviews | null>(null);
  const [ratings, setRatings] = useState<PropertyRatings | null>(null);

  // Dialog state
  const [enqOpen, setEnqOpen] = useState(false);
  const [enqKind, setEnqKind] = useState<EnquiryKind>("GENERAL");
  const [enqRoute, setEnqRoute] = useState<"OWNER" | "AGENT">("OWNER");
  const [rateTarget, setRateTarget] = useState<RatingTarget | null>(null);
  // Who the client wants to reach — owner or listing agent (their choice).
  const [contactRoute, setContactRoute] = useState<"OWNER" | "AGENT">("OWNER");
  // Initialize the chooser from the listing default ONCE per property —
  // background refreshes (load()) must not clobber the visitor's choice.
  const routeInitFor = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!propertyId) return;
    setLoading(true);
    publicApi
      .getProperty(propertyId)
      .then((p) => {
        setProperty(p);
        if (routeInitFor.current !== p.id) {
          routeInitFor.current = p.id;
          setContactRoute(
            p.contactRoute === "AGENT" && p.listedByAgentId ? "AGENT" : "OWNER"
          );
        }
        setLoading(false);
      })
      .catch((e) => {
        toastError(e, "Could not load this home");
        setLoading(false);
      });
  }, [propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  // Rating summaries (property + owner + agent) — lazy, never blocks.
  const loadRatings = useCallback(() => {
    if (!propertyId) return;
    publicApi
      .getPropertyRatings(propertyId)
      .then(setRatings)
      .catch(() => setRatings(null));
  }, [propertyId]);

  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

  // Tenant feedback (public) — lazy, never blocks the page.
  useEffect(() => {
    if (!propertyId) return;
    let alive = true;
    publicApi
      .getPropertyReviews(propertyId)
      .then((r) => {
        if (alive) setReviews(r);
      })
      .catch(() => {
        if (alive) setReviews(null);
      });
    return () => {
      alive = false;
    };
  }, [propertyId]);

  const photos = useMemo(() => property?.photos ?? [], [property]);
  const saved = propertyId ? savedIds.includes(propertyId) : false;
  const hasAgent = Boolean(property?.listedByAgentId);
  const rented = property?.status === "RENTED";

  const doContact = useCallback(
    async (method: "WHATSAPP" | "CALL", route: "OWNER" | "AGENT") => {
      if (!property) return;
      const setter = method === "CALL" ? setCalling : setContacting;
      setter(true);
      try {
        const res = await publicApi.contactProperty(property.id, undefined, method, route);
        addRecentContact({
          propertyId: property.id,
          title: property.title,
          block: property.block,
          rent: property.rent,
          at: new Date().toISOString(),
        });
        if (method === "CALL") {
          toastSuccess(
            "Opening dialer",
            res.route === "AGENT" ? "Calling the listing agent…" : "Calling the owner…"
          );
          window.location.href = res.telLink;
        } else {
          toastSuccess(
            "Opening WhatsApp",
            res.route === "AGENT"
              ? "Chat with the listing agent — good luck!"
              : "Say hi to the owner — good luck!"
          );
          window.open(res.waLink, "_blank", "noopener,noreferrer");
        }
        load(); // refresh view/click counters
      } catch (e) {
        if (method === "WHATSAPP") {
          // The chosen party has no number on file — route the inquiry
          // through iShim instead of a dead end.
          toastInfo(
            "WhatsApp not available",
            route === "AGENT"
              ? "Inquire with the agent instead — they'll get back to you."
              : "Inquire with the owner instead — they'll get back to you."
          );
          setEnqKind("GENERAL");
          setEnqRoute(route);
          setEnqOpen(true);
        } else {
          toastError(e, "Could not start the call");
        }
      } finally {
        setter(false);
      }
    },
    [property, addRecentContact, load]
  );

  // One-tap contact — no login wall. The contact API is anonymous-safe
  // (logs the touchpoint and counters either way) so every visitor can
  // reach the owner or the agent in a single tap.
  const onWhatsApp = () => doContact("WHATSAPP", contactRoute);
  const onCall = () => doContact("CALL", contactRoute);

  const openEnquiry = (kind: EnquiryKind, route: "OWNER" | "AGENT" = contactRoute) => {
    setEnqKind(kind);
    setEnqRoute(route);
    setEnqOpen(true);
  };

  const onRate = (target: RatingTarget) => {
    // Ratings are tied to an account; locals browse without one, so the
    // rate buttons only render for signed-in staff/legacy users.
    if (!user) return;
    setRateTarget(target);
  };

  /** One-tap save — guests persist on-device, signed-in users also sync. */
  const onToggleSave = () => {
    if (!propertyId) return;
    const nextSaved = !savedIds.includes(propertyId);
    toggleSavedLocal(propertyId, nextSaved);
    toastSuccess(nextSaved ? "Saved to your homes" : "Removed from saved");
    if (user) {
      void clientApi.toggleSaved(propertyId).catch(() => undefined);
    }
  };

  const onShare = useCallback(async () => {
    if (!property) return;
    const url = `${window.location.origin}/p/${property.id}`;
    const text = `${property.title} — ${formatRent(property.rent)}/mo\n${property.block}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: property.title, text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } catch {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toastSuccess("Link copied", "Paste it into WhatsApp, Facebook or anywhere.");
      } catch {
        toastError(null, "Could not share this home");
      }
    }
  }, [property]);

  const goBack = () => {
    const hasFilters =
      searchFilters.block || searchFilters.houseType || searchFilters.q ||
      searchFilters.minRent !== undefined || searchFilters.maxRent !== undefined ||
      searchFilters.bedrooms !== undefined;
    setView(hasFilters ? "search" : "home");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6">
        <Skeleton className="mb-4 h-9 w-24 rounded-full" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="aspect-[4/3] rounded-3xl lg:col-span-2 lg:h-[420px]" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4 rounded-full" />
            <Skeleton className="h-5 w-1/2 rounded-full" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-12 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed p-12 text-center">
          <House className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-medium">This home is no longer available</p>
          <Button onClick={goBack} className="rounded-full">
            <ArrowLeft aria-hidden /> Back to browsing
          </Button>
        </div>
      </div>
    );
  }

  const ratingChip = (
    label: string,
    avg: number | null,
    count: number,
    hint?: string
  ) => (
    <div
      className="flex flex-col items-center gap-1 rounded-2xl bg-secondary/60 px-3 py-2.5 text-center"
      title={hint}
    >
      <StarsDisplay value={avg ?? 0} />
      <p className="text-sm font-semibold leading-none">
        {avg != null ? avg.toFixed(1) : "—"}
      </p>
      <p className="text-xs leading-none text-muted-foreground">
        {label} · {count}
      </p>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-6 pt-6 sm:px-6 md:pb-10">
      <Button
        variant="ghost"
        onClick={goBack}
        className="mb-4 min-h-11 rounded-full"
      >
        <ArrowLeft aria-hidden /> Back
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 lg:col-span-2"
        >
          <PhotoCarousel photos={photos} title={property.title} />

          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {property.title}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary" className="rounded-full">
                    <MapPin className="size-3.5" aria-hidden />
                    {property.block}
                  </Badge>
                  {property.mode === "BUSINESS" ? (
                    <Badge variant="secondary" className="rounded-full">
                      <Store className="size-3.5" aria-hidden />
                      Business space
                    </Badge>
                  ) : null}
                  <Badge variant="secondary" className="rounded-full">
                    {property.mode === "BUSINESS"
                      ? (BUSINESS_TYPE_LABELS[property.houseType] ?? property.houseType)
                      : (HOUSE_TYPE_LABELS[property.houseType] ?? property.houseType)}
                  </Badge>
                  {property.featured ? (
                    <Badge className="rounded-full bg-primary/90 text-primary-foreground">
                      <Star className="size-3 fill-current" aria-hidden />
                      {t("card.featured")}
                    </Badge>
                  ) : null}
                  {property.status === "RENTED" ? (
                    <Badge variant="secondary" className="rounded-full text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
                      {t("detail.currentlyRented")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="rounded-full text-primary">
                      <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
                      {t("detail.availableNow")}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-primary md:text-3xl">
                  {formatRent(property.rent)}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("detail.deposit")} {formatRent(property.deposit)}
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-1.5 gap-1 rounded-full",
                    property.negotiable
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {property.negotiable ? (
                    <>
                      <HandCoins className="size-3.5" aria-hidden />
                      {t("detail.negotiable")}
                    </>
                  ) : (
                    <>
                      <Tag className="size-3.5" aria-hidden />
                      {t("detail.fixed")}
                    </>
                  )}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-2xl border bg-card p-4 text-sm">
              {property.bedrooms > 0 ? (
                <span className="flex items-center gap-2">
                  <BedDouble className="size-5 text-primary" aria-hidden />
                  {property.bedrooms} Bedroom{property.bedrooms === 1 ? "" : "s"}
                </span>
              ) : null}
              {property.bathrooms > 0 ? (
                <span className="flex items-center gap-2">
                  <Bath className="size-5 text-primary" aria-hidden />
                  {property.bathrooms} Bathroom{property.bathrooms === 1 ? "" : "s"}
                </span>
              ) : null}
              {property.kitchen ? (
                <span className="flex items-center gap-2">
                  <CookingPot className="size-5 text-primary" aria-hidden />
                  {KITCHEN_LABELS[property.kitchen] ?? property.kitchen}
                </span>
              ) : null}
              {property.areaSqft ? (
                <span className="flex items-center gap-2 tabular-nums">
                  <Ruler className="size-5 text-primary" aria-hidden />
                  {property.areaSqft.toLocaleString("en-IN")} sq ft
                </span>
              ) : null}
              {property.widthFt ? (
                <span className="flex items-center gap-2 tabular-nums">
                  <MoveHorizontal className="size-5 text-primary" aria-hidden />
                  {property.widthFt} ft wide
                </span>
              ) : null}
            </div>

            {/* Contact section — embedded inside the page content at EVERY width,
                so WhatsApp / Call / Inquire / Book are always right here in the
                flow (never only in a side rail or floating bar). */}
            {rented ? (
              <section
                aria-label="Contact the listing"
                className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5"
              >
                <p className="mb-1 flex items-center gap-2 font-semibold">
                  <Clock className="size-4 text-muted-foreground" aria-hidden />
                  Currently rented out
                </p>
                <p className="mb-3 text-sm text-muted-foreground">
                  Ask the {hasAgent ? "listing agent" : "owner"} when it&apos;s free
                  again or about similar homes in {property.block}.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => openEnquiry("GENERAL")}
                  className="h-12 w-full rounded-full text-sm sm:text-base"
                >
                  <UserRound aria-hidden />
                  Inquire with the {hasAgent ? "agent" : "owner"}
                </Button>
              </section>
            ) : (
              <section
                aria-label="Contact the listing"
                className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {contactRoute === "AGENT" ? "Contact the listing agent" : "Contact the owner"}
                  </p>
                  {hasAgent ? (
                    <div
                      role="tablist"
                      aria-label="Choose who to contact"
                      className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={contactRoute === "OWNER"}
                        onClick={() => setContactRoute("OWNER")}
                        className={cn(
                          "flex min-h-9 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          contactRoute === "OWNER"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-secondary-foreground hover:bg-accent"
                        )}
                      >
                        <UserRound className="size-4" aria-hidden />
                        Owner
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={contactRoute === "AGENT"}
                        onClick={() => setContactRoute("AGENT")}
                        className={cn(
                          "flex min-h-9 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          contactRoute === "AGENT"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-secondary-foreground hover:bg-accent"
                        )}
                      >
                        <Briefcase className="size-4" aria-hidden />
                        Agent
                      </button>
                    </div>
                  ) : null}
                </div>
                <EnquiryActions
                  enquiryLabel={
                    contactRoute === "AGENT" && hasAgent ? "Ask the agent" : "Inquire"
                  }
                  contacting={contacting}
                  calling={calling}
                  onWhatsApp={onWhatsApp}
                  onCall={onCall}
                  onEnquiry={() => openEnquiry("GENERAL")}
                  onVisit={() => openEnquiry("VISIT")}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!property}
                  onClick={() => void onShare()}
                  className="mt-3 h-12 w-full rounded-full text-sm sm:text-base"
                >
                  <Share2 aria-hidden />
                  {t("detail.share")}
                </Button>
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  {contactRoute === "AGENT" ? (
                    <span>
                      You&apos;ll reach {ratings?.agent?.name ?? "the listing agent"} directly.
                      No brokerage — fee only after you rent.
                    </span>
                  ) : (
                    <span>
                      You&apos;ll reach the owner directly. No brokerage — fee only after you
                      rent.
                    </span>
                  )}
                </p>
              </section>
            )}

            {property.description ? (
              <div>
                <h2 className="mb-2 font-semibold">
                  {property.mode === "BUSINESS" ? t("detail.about.space") : t("detail.about.home")}
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {property.description}
                </p>
              </div>
            ) : null}

            {property.amenities?.length ? (
              <div>
                <h2 className="mb-2 font-semibold">{t("detail.amenities")}</h2>
                <ul className="flex flex-wrap gap-2" aria-label="Amenities">
                  {property.amenities.map((a) => (
                    <li
                      key={a}
                      className="rounded-full bg-secondary px-3.5 py-1.5 text-sm text-secondary-foreground"
                    >
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Ratings & reviews: home + owner + agent */}
            {ratings ? (
              <section aria-label="Ratings and reviews">
                <h2 className="mb-2 font-semibold">Ratings &amp; reviews</h2>
                <div className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
                  <div className="grid grid-cols-3 gap-2 sm:max-w-md">
                    {ratingChip("Home", ratings.property.avg, ratings.property.count, "Rated by iShim users")}
                    {ratingChip(
                      "Owner",
                      ratings.owner.avg,
                      ratings.owner.count,
                      "Rated by past tenants"
                    )}
                    {ratings.agent
                      ? ratingChip("Agent", ratings.agent.avg, ratings.agent.count, ratings.agent.name)
                      : null}
                  </div>

                  {user ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRate("PROPERTY")}
                        className="rounded-full"
                      >
                        <Star aria-hidden />
                        {ratings.mine.property ? "Update your home rating" : "Rate this home"}
                      </Button>
                      {ratings.agent ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRate("AGENT")}
                          className="rounded-full"
                        >
                          <UserRound aria-hidden />
                          {ratings.mine.agent
                            ? `Update rating for ${ratings.agent.name}`
                            : `Rate ${ratings.agent.name}`}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {ratings.property.ratings.length ? (
                    <ul className="mt-4 space-y-3">
                      {ratings.property.ratings.map((r) => (
                        <li key={r.id} className="rounded-2xl bg-secondary/50 p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">{r.user}</span>
                            <StarsDisplay value={r.rating} />
                          </div>
                          {r.comment ? (
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                              {r.comment}
                            </p>
                          ) : null}
                          <p className="mt-1.5 text-xs text-muted-foreground/70">
                            {formatDate(r.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No home ratings yet — be the first to rate it.
                    </p>
                  )}
                </div>
              </section>
            ) : null}

            {/* Tenant feedback: owner ratings + notes for the next tenants */}
            {reviews && reviews.reviews.length > 0 ? (
              <section aria-label="What tenants say">
                <h2 className="mb-2 font-semibold">What tenants say</h2>
                <div className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <StarsDisplay value={reviews.summary.avg ?? 0} size="size-4" />
                    <span className="text-sm font-medium">
                      {reviews.summary.avg ? reviews.summary.avg.toFixed(1) : "—"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      · owner rated by {reviews.summary.count} tenant
                      {reviews.summary.count === 1 ? "" : "s"}
                    </span>
                    {reviews.summary.staying > 0 ? (
                      <span className="text-xs font-medium text-primary">
                        · {reviews.summary.staying} living here now
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-4 space-y-3">
                    {reviews.reviews.map((r) => (
                      <li key={r.id} className="rounded-2xl bg-secondary/50 p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">{r.tenant}</span>
                          <TenancyStatusPill status={r.status} />
                        </div>
                        {typeof r.ownerRating === "number" ? (
                          <StarsDisplay value={r.ownerRating} className="mt-1.5" />
                        ) : null}
                        {r.remark ? (
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {r.remark}
                          </p>
                        ) : null}
                        <p className="mt-1.5 text-xs text-muted-foreground/70">
                          {formatDate(r.updatedAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : reviews ? (
              <p className="text-sm text-muted-foreground">
                No tenant notes yet — lived here? Share your experience from My
                stays in your profile.
              </p>
            ) : null}
          </div>
        </motion.div>

        {/* Desktop sidebar */}
        <motion.aside
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
          className="hidden space-y-4 lg:block"
        >
          <div className="sticky top-24 space-y-4">
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onToggleSave}
                  aria-pressed={saved}
                  className="h-11 flex-1 rounded-full"
                >
                  <Heart
                    className={cn(saved && "fill-primary text-primary")}
                    aria-hidden
                  />
                  {saved ? t("detail.saved") : t("detail.saveHome")}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("detail.share")}
                  onClick={() => void onShare()}
                  className="size-11 shrink-0 rounded-full"
                >
                  <Share2 className="size-4.5" aria-hidden />
                </Button>
              </div>
              <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                {t("detail.brokerageNote")}
              </p>
            </div>

            <div className="space-y-3 rounded-3xl border bg-card p-5 text-sm shadow-sm">
              {property.owner?.verified ? (
                <p className="flex items-center gap-2 font-medium text-primary">
                  <BadgeCheck className="size-5" aria-hidden />
                  Verified owner
                </p>
              ) : (
                <p className="flex items-center gap-2 font-medium text-amber-700">
                  <TriangleAlert className="size-5" aria-hidden />
                  Owner pending verification
                </p>
              )}
              {hasAgent ? (
                <p className="flex items-center gap-2 font-medium text-primary">
                  <UserRound className="size-5" aria-hidden />
                  Handled by a listing agent
                </p>
              ) : null}
              <p className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Clock className="size-4" aria-hidden /> Listed
                </span>
                <span className="font-medium text-foreground">
                  {formatDate(property.createdAt)}
                </span>
              </p>
              <p className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Eye className="size-4" aria-hidden /> Views
                </span>
                <span className="font-medium text-foreground">{property.views ?? 0}</span>
              </p>
            </div>
          </div>
        </motion.aside>
      </div>

      {/* Enquiry / visit booking dialog */}
      <EnquiryDialog
        open={enqOpen}
        onOpenChange={setEnqOpen}
        propertyId={property.id}
        propertyTitle={property.title}
        propertyBlock={property.block}
        initialKind={enqKind}
        hasAgent={hasAgent}
        route={enqRoute}
      />

      {/* Rate home / agent dialog */}
      <RatingDialog
        open={rateTarget !== null}
        onOpenChange={(v) => {
          if (!v) setRateTarget(null);
        }}
        propertyId={property.id}
        target={rateTarget ?? "PROPERTY"}
        agentName={ratings?.agent?.name}
        initialRating={
          rateTarget === "AGENT" ? ratings?.mine.agent?.rating : ratings?.mine.property?.rating
        }
        initialComment={
          rateTarget === "AGENT" ? ratings?.mine.agent?.comment : ratings?.mine.property?.comment
        }
        onSaved={loadRatings}
      />
    </div>
  );
}
