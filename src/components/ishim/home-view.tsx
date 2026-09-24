"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Photo } from "./photo";
import { PropertyCard, PropertyCardSkeleton } from "./property-card";
import { AdsCarousel } from "./ads-carousel";
import { OmniSearchPanel } from "./omni-search";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { publicApi } from "@/lib/api";
import { toastError } from "@/lib/feedback";
import type { Property } from "@/lib/types";

function Hero() {
  const mode = useStore((s) => s.mode);
  const business = mode === "BUSINESS";
  const t = useT();

  return (
    <section className="relative overflow-hidden" aria-label="Hero">
      <div className="relative h-[68vh] min-h-[520px] w-full">
        { }
        <img
          src={business ? "/images/hero-business.jpg" : "/images/hero.jpg"}
          alt={business ? "Shops and market street in Ukhrul" : "Homes in the hills of Ukhrul"}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = "none";
          }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/30 to-black/55"
          aria-hidden
        />
        <div className="relative flex h-full flex-col items-center justify-center gap-6 px-4">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 text-white drop-shadow"
          >
            { }
            <img
              src="/brand/icon-192.png"
              alt=""
              aria-hidden
              className="size-10 rounded-xl bg-white/20 p-1 backdrop-blur"
            />
            <span className="text-3xl font-semibold tracking-tight">iShim</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="glass w-full max-w-xl rounded-3xl p-5 md:p-7"
          >
            <h1 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
              {business ? t("hero.title.business") : t("hero.title.homes")}
            </h1>
            <p className="mt-1.5 text-center text-sm text-muted-foreground md:text-base">
              {business ? t("hero.sub.business") : t("hero.sub.homes")}
            </p>
            <div className="mt-5">
              <OmniSearchPanel variant="hero" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FeaturedSection() {
  const mode = useStore((s) => s.mode);
  const business = mode === "BUSINESS";
  const t = useT();
  const [featured, setFeatured] = useState<Property[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const goSearch = useStore((s) => s.goSearch);

  const load = () => {
    publicApi
      .getProperties({ featured: true, mode })
      .then((data) => {
        setFeatured(data.items);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
      });
  };

  useEffect(load, [mode]);

  return (
    <section
      aria-label={business ? "Featured business spaces" : "Featured homes"}
      className="mx-auto w-full min-w-0 max-w-6xl"
    >
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
            {business ? t("featured.title.business") : t("featured.title.homes")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {business ? t("featured.sub.business") : t("featured.sub.homes")}
          </p>
        </div>
        <Button variant="ghost" onClick={() => goSearch()} className="rounded-full">
          {t("featured.seeAll")}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="secondary" className="mt-3 rounded-full" onClick={load}>
            Retry
          </Button>
        </div>
      ) : featured === null ? (
        <div className="flex gap-4 overflow-hidden md:grid md:grid-cols-3 md:gap-6">
          {[0, 1, 2].map((i) => (
            <PropertyCardSkeleton key={i} className="w-full shrink-0 md:w-auto" />
          ))}
        </div>
      ) : featured.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/40 p-10 text-center text-sm text-muted-foreground">
          {business ? t("featured.empty.business") : t("featured.empty.homes")}
        </div>
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-pl-4 px-4 pb-2 no-scrollbar sm:-mx-6 sm:scroll-pl-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0">
          {featured.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              className="w-full shrink-0 snap-start md:w-auto"
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Photos for the seeded Ukhrul blocks; admin-added blocks fall back to a shared scenic image. */
const BLOCK_IMAGES: Record<string, string> = {
  Hungpung: "/images/blocks/hungpung.jpg",
  Viewland: "/images/blocks/viewland.jpg",
  Phungyo: "/images/blocks/phungyo.jpg",
  Phungwamee: "/images/blocks/phungwamee.jpg",
  "Mini Veng": "/images/blocks/mini-veng.jpg",
  Halisahar: "/images/blocks/halisahar.jpg",
  Dungrei: "/images/blocks/dungrei.jpg",
  "Old Bazaar": "/images/blocks/old-bazaar.jpg",
  "TNL Ward": "/images/blocks/tnl-ward.jpg",
  Nungshang: "/images/blocks/nungshang.jpg",
};

const BLOCK_CARD =
  "group relative block-card-w shrink-0 snap-start overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-primary/30 text-left shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function BlockCardSkeleton() {
  return <Skeleton className={cn(BLOCK_CARD, "aspect-[4/3]")} />;
}

function BlocksSection() {
  const settings = useStore((s) => s.settings);
  const goSearch = useStore((s) => s.goSearch);
  const mode = useStore((s) => s.mode);
  const business = mode === "BUSINESS";
  const t = useT();
  const blocks = settings?.blocks ?? [];

  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  // Live listing counts per block (ACTIVE listings, current vertical only).
  useEffect(() => {
    let alive = true;
    publicApi
      .getBlockStats(mode)
      .then((d) => {
        if (!alive) return;
        setCounts(d.counts);
        setTotal(d.total);
      })
      .catch(() => {
        if (alive) setCounts({});
      });
    return () => {
      alive = false;
    };
  }, [mode]);

  const loading = !settings;

  return (
    <section
      aria-label="Browse by block"
      className="mx-auto w-full min-w-0 max-w-6xl"
    >
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
            {t("blocks.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === null
              ? business
                ? t("blocks.sub.business")
                : t("blocks.sub.homes")
              : business
                ? `${total === 1 ? "1 business space" : `${total ?? 0} business spaces`} across ${blocks.length} neighborhoods.`
                : `${total === 1 ? "1 verified home" : `${total ?? 0} verified homes`} across ${blocks.length} neighborhoods.`}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => goSearch()}
          className="hidden shrink-0 rounded-full text-primary hover:bg-primary/5 hover:text-primary sm:inline-flex"
        >
          {t("blocks.viewAll")}
          <ArrowRight aria-hidden />
        </Button>
      </div>

      {loading ? (
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:px-0">
          {Array.from({ length: 10 }).map((_, i) => (
            <BlockCardSkeleton key={i} />
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("blocks.empty")}
        </div>
      ) : (
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-pl-4 px-4 pb-1 sm:-mx-6 sm:scroll-pl-6 sm:px-6 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0 md:pb-0">
          {blocks.map((b) => {
            const n = counts?.[b] ?? 0;
            return (
              <button
                key={b}
                type="button"
                onClick={() => goSearch({ block: b })}
                aria-label={`Browse ${business ? "business spaces" : "homes"} in ${b}`}
                className={BLOCK_CARD}
              >
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <img
                    src={settings?.wardImages?.[b] ?? BLOCK_IMAGES[b] ?? "/images/blocks/viewland.jpg"}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.style.opacity = "0";
                    }}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                  />
                </div>
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white drop-shadow-sm">
                      {b}
                    </p>
                    <p className="text-[11px] font-medium text-white/80">
                      {counts === null
                        ? "\u2026"
                        : n > 0
                          ? `${n} ${business ? (n === 1 ? "space" : "spaces") : n === 1 ? "home" : "homes"}`
                          : business
                            ? "No spaces yet"
                            : "No homes yet"}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 translate-y-1.5 place-items-center rounded-full bg-white/95 text-foreground opacity-0 shadow-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                  >
                    <ArrowRight className="size-4" aria-hidden />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function HomeView() {
  return (
    <div className="flex flex-col gap-12 pb-6 md:gap-16">
      <Hero />
      <AdsCarousel />
      <FeaturedSection />
      <BlocksSection />
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-2 text-sm text-muted-foreground">
        <BadgeCheck className="size-4 text-primary" aria-hidden />
        Every listing is reviewed by the iShim team before it goes live.
      </div>
    </div>
  );
}
