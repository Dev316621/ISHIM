"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Filter,
  Loader2,
  Navigation,
  RotateCcw,
  SearchX,
  Sparkles,
  SlidersHorizontal,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { nearestBlocks } from "@/lib/blocks-near";
import { PropertyCard, PropertyCardSkeleton } from "./property-card";
import { EmptyState } from "./empty-state";
import { OmniSearchPanel } from "./omni-search";
import { useStore } from "@/lib/store";
import { insightsApi, publicApi } from "@/lib/api";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  HOUSE_TYPE_LABELS,
  type Property,
  type RecommendResponse,
  type SearchScope,
} from "@/lib/types";

const PRICE_STEPS = [1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000, 50000];

/** Quick price bands for the one-tap chip row. */
const PRICE_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: "Any rent" },
  { label: "< ₹5k", max: 5000 },
  { label: "₹5k–10k", min: 5000, max: 10000 },
  { label: "₹10k–20k", min: 10000, max: 20000 },
  { label: "₹20k+", min: 20000 },
];

const BED_CHIPS = [
  { label: "Any", value: undefined },
  { label: "1+ BHK", value: 1 },
  { label: "2+ BHK", value: 2 },
  { label: "3+ BHK", value: 3 },
];

const SEGMENTS = [
  { key: "foryou", label: "For you" },
  { key: "featured", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "all", label: "Everything" },
] as const;

type SegmentKey = (typeof SEGMENTS)[number]["key"];

function chipClass(active: boolean) {
  return cn(
    "min-h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "border-primary bg-primary text-primary-foreground shadow-sm"
      : "border-border/80 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
  );
}

function TypeSelectItems({ scope }: { scope: SearchScope }) {
  const homeTypes = scope === "BUSINESS" ? [] : ["ASSAM_TYPE", "RCC", "KUTCHA", "APARTMENT"];
  const bizTypes = scope === "HOME" ? [] : BUSINESS_TYPES;

  return (
    <>
      {homeTypes.length > 0 ? (
        <SelectGroup>
          <SelectLabel>Homes</SelectLabel>
          {homeTypes.map((t) => (
            <SelectItem key={`h-${t}`} value={`HOME:${t}`}>
              {HOUSE_TYPE_LABELS[t] ?? t}
            </SelectItem>
          ))}
        </SelectGroup>
      ) : null}
      {bizTypes.length > 0 ? (
        <SelectGroup>
          <SelectLabel>Business</SelectLabel>
          {bizTypes.map((t) => (
            <SelectItem key={`b-${t}`} value={`BUSINESS:${t}`}>
              {BUSINESS_TYPE_LABELS[t] ?? t}
            </SelectItem>
          ))}
        </SelectGroup>
      ) : null}
    </>
  );
}

function FiltersControls() {
  const settings = useStore((s) => s.settings);
  const filters = useStore((s) => s.searchFilters);
  const setSearchFilters = useStore((s) => s.setSearchFilters);
  const clearFilters = useStore((s) => s.clearFilters);
  const scope = filters.scope;
  const business = scope === "BUSINESS";
  const all = scope === "";

  // Combined "VERTICAL:TYPE" value for the type select.
  const typeValue = filters.houseType
    ? `${business ? "BUSINESS" : "HOME"}:${filters.houseType}`
    : "ANY";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Block</Label>
          <Select
            value={filters.block || "ANY"}
            onValueChange={(v) => setSearchFilters({ block: v === "ANY" ? "" : v })}
          >
            <SelectTrigger aria-label="Block filter" className="h-11 rounded-xl">
              <SelectValue placeholder="Any block" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANY">Any block</SelectItem>
              {(settings?.blocks ?? []).map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{all ? "Type (homes & business)" : business ? "Space type" : "House type"}</Label>
          <Select
            value={typeValue}
            onValueChange={(v) => {
              if (v === "ANY") {
                setSearchFilters({ houseType: "" });
                return;
              }
              const [m, t] = v.split(":");
              setSearchFilters({ houseType: t, scope: m as "HOME" | "BUSINESS" });
            }}
          >
            <SelectTrigger aria-label="Type filter" className="h-11 rounded-xl">
              <SelectValue placeholder="Any type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANY">Any type</SelectItem>
              <TypeSelectItems scope={scope} />
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Min rent (₹)</Label>
          <Select
            value={filters.minRent !== undefined ? String(filters.minRent) : "ANY"}
            onValueChange={(v) =>
              setSearchFilters({ minRent: v === "ANY" ? undefined : Number(v) })
            }
          >
            <SelectTrigger aria-label="Minimum rent filter" className="h-11 rounded-xl">
              <SelectValue placeholder="No minimum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANY">No minimum</SelectItem>
              {PRICE_STEPS.map((p) => (
                <SelectItem key={p} value={String(p)}>
                  ₹{p.toLocaleString("en-IN")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Max rent (₹)</Label>
          <Select
            value={filters.maxRent !== undefined ? String(filters.maxRent) : "ANY"}
            onValueChange={(v) =>
              setSearchFilters({ maxRent: v === "ANY" ? undefined : Number(v) })
            }
          >
            <SelectTrigger aria-label="Maximum rent filter" className="h-11 rounded-xl">
              <SelectValue placeholder="No maximum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANY">No maximum</SelectItem>
              {PRICE_STEPS.map((p) => (
                <SelectItem key={p} value={String(p)}>
                  ₹{p.toLocaleString("en-IN")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!business ? (
          <div className="space-y-2">
            <Label>Bedrooms</Label>
            <Select
              value={filters.bedrooms !== undefined ? String(filters.bedrooms) : "ANY"}
              onValueChange={(v) =>
                setSearchFilters({ bedrooms: v === "ANY" ? undefined : Number(v) })
              }
            >
              <SelectTrigger aria-label="Bedrooms filter" className="h-11 rounded-xl">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">Any</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}+ BHK
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            onClick={clearFilters}
            className="h-11 w-full rounded-xl"
          >
            <RotateCcw aria-hidden />
            Clear filters
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SearchView() {
  const filters = useStore((s) => s.searchFilters);
  const setSearchFilters = useStore((s) => s.setSearchFilters);
  const settings = useStore((s) => s.settings);
  const clearFilters = useStore((s) => s.clearFilters);

  // Scope: "" = Everything (both verticals) — the universal engine default.
  const scope = filters.scope;
  const scopeParam = scope || undefined; // undefined → API searches both modes
  const business = scope === "BUSINESS";
  const everything = scope === "";

  const [segment, setSegment] = useState<SegmentKey>(filters.q ? "all" : "foryou");
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">("newest");

  const [results, setResults] = useState<Property[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recommend, setRecommend] = useState<RecommendResponse | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Debounce keyword-only changes; other filters are discrete controls.
  const [tick, setTick] = useState(0);
  const prevQ = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevQ.current === undefined) {
      prevQ.current = filters.q;
      return;
    }
    if (prevQ.current === filters.q) return;
    prevQ.current = filters.q;
    const t = window.setTimeout(() => setTick((x) => x + 1), 350);
    return () => window.clearTimeout(t);
  }, [filters.q]);

  const qRef = useRef(filters.q);
  useEffect(() => {
    qRef.current = filters.q;
  }, [filters.q]);

  const effSort = segment === "all" ? sortBy : "newest";
  const nearOn = !!filters.near && !!filters.block;
  const filterKey = `${scope}|${segment}|${sortBy}|${filters.block}|${filters.houseType}|${filters.minRent ?? ""}|${filters.maxRent ?? ""}|${filters.bedrooms ?? ""}|${nearOn ? 1 : 0}|${tick}`;
  const loading = loadedKey !== filterKey;

  const load = useCallback(() => {
    const base = {
      mode: scopeParam,
      block: filters.block || undefined,
      near: nearOn ? (1 as const) : undefined,
      houseType: filters.houseType || undefined,
      minRent: filters.minRent,
      maxRent: filters.maxRent,
      bedrooms: filters.bedrooms,
      q: qRef.current || undefined,
    };

    // With an explicit query, the search engine always lists matching
    // listings — "For you" personalization only applies to open browsing.
    if (segment === "foryou" && !qRef.current) {
      publicApi
        .getRecommended(scopeParam)
        .then(async (data) => {
          if (data.profile) {
            setResults(data.properties);
            setTotal(data.properties.length);
            setHasMore(false);
          } else {
            // No habits yet — fall back to newest so the page is never empty.
            const fallback = await publicApi.getProperties({ ...base, sort: "newest" });
            setResults(fallback.items);
            setTotal(fallback.total);
            setHasMore(fallback.hasMore);
          }
          setRecommend(data);
          setError(null);
          setLoadedKey(filterKey);
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Failed to load results");
          setLoadedKey(filterKey);
        });
      return;
    }

    publicApi
      .getProperties({
        ...base,
        featured: segment === "featured" ? true : undefined,
        sort: effSort,
      })
      .then((data) => {
        setResults(data.items);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setError(null);
        setLoadedKey(filterKey);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load results");
        setLoadedKey(filterKey);
      });
  }, [scopeParam, filters.block, filters.houseType, filters.minRent, filters.maxRent, filters.bedrooms, nearOn, tick, segment, effSort, filterKey]);

  /** Append the next offset page to the current results ("Load more"). */
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || results === null) return;
    setLoadingMore(true);
    publicApi
      .getProperties({
        mode: scopeParam,
        block: filters.block || undefined,
        near: nearOn ? (1 as const) : undefined,
        houseType: filters.houseType || undefined,
        minRent: filters.minRent,
        maxRent: filters.maxRent,
        bedrooms: filters.bedrooms,
        q: qRef.current || undefined,
        featured: segment === "featured" ? true : undefined,
        sort: effSort,
        skip: results.length,
      })
      .then((data) => {
        setResults((prev) => {
          const seen = new Set((prev ?? []).map((p) => p.id));
          return [...(prev ?? []), ...data.items.filter((p) => !seen.has(p.id))];
        });
        setTotal(data.total);
        setHasMore(data.hasMore);
      })
      .catch(() => {
        // Keep the loaded page; a retry simply re-runs loadMore.
      })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, results, scopeParam, filters.block, filters.houseType, filters.minRent, filters.maxRent, filters.bedrooms, nearOn, segment, effSort]);

  useEffect(() => {
    load();
  }, [load]);

  // Habit analytics: track every settled, non-empty search so the
  // "For you" ranking and demand reports learn from it.
  const trackedKey = useRef<string | null>(null);
  useEffect(() => {
    if (loading || segment === "foryou") return;
    const hasIntent =
      filters.block ||
      filters.houseType ||
      filters.minRent !== undefined ||
      filters.maxRent !== undefined ||
      filters.bedrooms !== undefined ||
      qRef.current;
    if (!hasIntent) return;
    if (trackedKey.current === filterKey) return;
    trackedKey.current = filterKey;
    void insightsApi.trackSearch({
      query: qRef.current || undefined,
      block: filters.block || undefined,
      houseType: filters.houseType || undefined,
      minRent: filters.minRent,
      maxRent: filters.maxRent,
    });
  }, [loading, filterKey, segment, filters.block, filters.houseType, filters.minRent, filters.maxRent, filters.bedrooms]);

  // Block chips with live listing counts (scoped to the active vertical).
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let alive = true;
    publicApi
      .getBlockStats(scopeParam)
      .then((d) => {
        if (alive) setCounts(d.counts);
      })
      .catch(() => {
        if (alive) setCounts({});
      });
    return () => {
      alive = false;
    };
  }, [scopeParam]);

  // ── "Nearby <block>" strip: listings from the closest wards, shown when a
  // single block is selected (skipped in proximity mode — it's already in). ──
  const [nearbyListings, setNearbyListings] = useState<Property[]>([]);
  const [nearbyBlocks, setNearbyBlocks] = useState<string[]>([]);
  useEffect(() => {
    if (!filters.block || nearOn || loading) {
      // Clear asynchronously (never setState synchronously in the effect body).
      const clear = window.setTimeout(() => {
        setNearbyListings([]);
        setNearbyBlocks([]);
      }, 0);
      return () => window.clearTimeout(clear);
    }
    const wards = nearestBlocks(
      filters.block,
      settings?.blocks ?? ["Hungpung", "Viewland", "Phungyo", "Phungwamee", "Mini Veng", "Halisahar", "Dungrei", "Old Bazaar", "TNL Ward", "Nungshang"]
    ).slice(0, 2);
    let alive = true;
    Promise.all(
      wards.map((b) =>
        publicApi
          .getProperties({ block: b, mode: scopeParam, limit: 3 })
          .then((d) => d.items)
          .catch(() => [] as Property[])
      )
    )
      .then((lists) => {
        if (!alive) return;
        setNearbyBlocks(wards);
        setNearbyListings(lists.flat().slice(0, 3));
      })
      .catch(() => {
        if (alive) {
          setNearbyListings([]);
          setNearbyBlocks([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [filters.block, nearOn, loading, scopeParam, settings?.blocks]);

  const activeBandIndex = PRICE_BANDS.findIndex(
    (b) =>
      (b.min ?? undefined) === filters.minRent &&
      (b.max ?? undefined) === filters.maxRent
  );

  const activeCount = useMemo(
    () =>
      [
        filters.block,
        filters.houseType,
        filters.minRent !== undefined ? "min" : "",
        filters.maxRent !== undefined ? "max" : "",
        filters.bedrooms !== undefined ? "beds" : "",
        filters.near && filters.block ? "near" : "",
        filters.q,
        filters.scope ? "scope" : "",
      ].filter(Boolean).length,
    [filters]
  );

  const personalized = segment === "foryou" && !!recommend?.profile && !filters.q.trim();
  const resultCount = results?.length ?? 0;

  /** Label for the noun used across headings ("home(s)", "space(s)", "result(s)"). */
  const noun = (n: number) =>
    everything
      ? n === 1
        ? "result"
        : "results"
      : business
        ? n === 1
          ? "space"
          : "spaces"
        : n === 1
          ? "home"
          : "homes";

  const heading = () => {
    const place = filters.block;
    const q = filters.q.trim();
    const where = place ? (nearOn ? ` near ${place}` : ` in ${place}`) : "";
    if (q) return `Results for “${q}”`;
    if (everything) {
      if (segment === "foryou") return personalized ? "Picked for you" : "Everything on iShim";
      if (segment === "featured") return "Featured homes & spaces";
      if (segment === "newest") return "Newest on iShim";
      return place ? `Everything${where}` : "Everything on iShim";
    }
    if (business) {
      if (segment === "foryou") return personalized ? "Picked for you" : "Business spaces in Ukhrul";
      if (segment === "featured") return "Featured spaces";
      if (segment === "newest") return "Newest spaces";
      return place ? `Business spaces${where}` : "All business spaces in Ukhrul";
    }
    if (segment === "foryou") return personalized ? "Picked for you" : "Homes in Ukhrul";
    if (segment === "featured") return "Featured homes";
    if (segment === "newest") return "Newest homes";
    return place ? `Homes${where}` : "All homes in Ukhrul";
  };

  // Type chips: both verticals when scope is Everything.
  const homeTypeChips = settings?.houseTypes ?? ["ASSAM_TYPE", "RCC", "KUTCHA", "APARTMENT"];
  const typeChips: Array<{ t: string; m: "HOME" | "BUSINESS" }> =
    business
      ? BUSINESS_TYPES.map((t) => ({ t, m: "BUSINESS" as const }))
      : everything
        ? [
            ...homeTypeChips.map((t) => ({ t, m: "HOME" as const })),
            ...BUSINESS_TYPES.map((t) => ({ t, m: "BUSINESS" as const })),
          ]
        : homeTypeChips.map((t) => ({ t, m: "HOME" as const }));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6">
      {/* ── Universal (Google-style) search ── */}
      <section aria-label="Search iShim" className="mb-4">
        <OmniSearchPanel
          key={filters.q}
          variant="page"
          initialQuery={filters.q}
          scope={filters.scope}
          onScopeChange={(s) => setSearchFilters({ scope: s })}
        />

        {/* Common places (blocks) with live counts */}
        <div
          aria-label="Common places"
          className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
        >
          <button
            type="button"
            onClick={() => setSearchFilters({ block: "", near: false })}
            className={chipClass(!filters.block)}
          >
            All places
          </button>
          {filters.block ? (
            <button
              type="button"
              onClick={() => setSearchFilters({ near: !nearOn })}
              aria-pressed={nearOn}
              className={chipClass(nearOn)}
            >
              <Navigation className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
              Nearby wards
            </button>
          ) : null}
          {(settings?.blocks ?? []).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setSearchFilters({ block: filters.block === b ? "" : b })}
              className={chipClass(filters.block === b)}
            >
              {b}
              {counts?.[b] ? (
                <span
                  className={cn(
                    "ml-1.5 text-[11px]",
                    filters.block === b ? "text-primary-foreground/80" : "text-primary"
                  )}
                >
                  {counts[b]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Easy filters */}
        <div
          aria-label="Quick filters"
          className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
        >
          {PRICE_BANDS.map((b, i) => (
            <button
              key={b.label}
              type="button"
              onClick={() =>
                setSearchFilters({
                  minRent: activeBandIndex === i ? undefined : b.min,
                  maxRent: activeBandIndex === i ? undefined : b.max,
                })
              }
              className={chipClass(activeBandIndex === i)}
            >
              {b.label}
            </button>
          ))}
          {scope !== "BUSINESS" ? (
            <>
              <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-border/70" />
              {BED_CHIPS.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setSearchFilters({ bedrooms: b.value })}
                  className={chipClass(filters.bedrooms === b.value)}
                >
                  {b.label}
                </button>
              ))}
            </>
          ) : null}
          <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-border/70" />
          {typeChips.map(({ t, m }) => {
            const active = filters.houseType === t;
            return (
              <button
                key={`${m}:${t}`}
                type="button"
                onClick={() =>
                  setSearchFilters(
                    active ? { houseType: "" } : { houseType: t, scope: m }
                  )
                }
                className={chipClass(active)}
              >
                {m === "BUSINESS" ? (BUSINESS_TYPE_LABELS[t] ?? t) : (HOUSE_TYPE_LABELS[t] ?? t)}
                {m === "BUSINESS" && everything ? (
                  <Store className="ml-1 inline size-3 align-[-1px]" aria-label="Business" />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Segments + tools ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Browse mode"
          className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1"
        >
          {SEGMENTS.map((sg) => (
            <button
              key={sg.key}
              role="tab"
              type="button"
              aria-selected={segment === sg.key}
              onClick={() => setSegment(sg.key)}
              className={cn(
                "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                segment === sg.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {sg.key === "foryou" ? <Sparkles aria-hidden className="size-3.5" /> : null}
              {sg.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {segment === "all" ? (
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as typeof sortBy)}
            >
              <SelectTrigger
                aria-label="Sort results"
                className="h-9 w-[170px] rounded-full bg-card text-[13px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="price_asc">Rent: low to high</SelectItem>
                <SelectItem value="price_desc">Rent: high to low</SelectItem>
              </SelectContent>
            </Select>
          ) : null}

          {/* Desktop: collapsible advanced panel */}
          <Button
            variant="outline"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="hidden min-h-9 rounded-full md:inline-flex"
          >
            <SlidersHorizontal aria-hidden />
            More filters
            {activeCount > 0 ? (
              <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {activeCount}
              </span>
            ) : null}
          </Button>

          {/* Mobile: sheet */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="min-h-9 rounded-full md:hidden">
                <Filter aria-hidden />
                More
                {activeCount > 0 ? (
                  <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {activeCount}
                  </span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="rounded-t-3xl px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4"
            >
              <SheetHeader className="p-0 pb-3 text-left">
                <SheetTitle>More filters</SheetTitle>
              </SheetHeader>
              <div className="max-h-[65vh] overflow-y-auto thin-scrollbar pr-1">
                <FiltersControls />
              </div>
              <Button
                className="mt-4 h-11 w-full rounded-full"
                onClick={() => setSheetOpen(false)}
              >
                Show {loading ? "…" : `${resultCount} ${noun(resultCount)}`}
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop advanced filters (collapsed by default) */}
      {moreOpen ? (
        <section
          aria-label="Advanced filters"
          className="mb-6 rounded-3xl border bg-card p-5 shadow-sm"
        >
          <FiltersControls />
        </section>
      ) : null}

      {/* ── Heading / personalization note ── */}
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{heading()}</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading
            ? "Searching…"
            : total > resultCount
              ? `${resultCount} of ${total} ${everything ? "results · homes & business" : noun(total)}`
              : `${total > resultCount ? total : resultCount} ${noun(total > resultCount ? total : resultCount)}${everything ? " · homes & business" : ""}`}
        </p>
      </div>

      {personalized ? (
        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Based on {recommend?.profile?.events} recent{" "}
          {recommend?.profile?.events === 1 ? "action" : "actions"} —{" "}
          {[recommend?.profile?.blocks?.[0], recommend?.profile?.budget]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      {/* ── Results ── */}
      {error ? (
        <EmptyState
          icon={SearchX}
          title={business ? "We couldn't load business spaces" : "We couldn't load results"}
          description={error}
          actionLabel="Retry"
          onAction={load}
        />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <PropertyCardSkeleton key={i} />
          ))}
        </div>
      ) : results && results.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {results.map((p) => (
              <PropertyCard key={p.id} property={p} showMode={everything} />
            ))}
          </div>

          {/* Pagination — Load more appends the next offset page. */}
          {hasMore ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loadingMore}
                onClick={loadMore}
                className="min-h-11 rounded-full px-8"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  "Load more listings"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Showing {resultCount} of {total}
              </p>
            </div>
          ) : (
            <p
              className="mt-8 text-center text-xs text-muted-foreground"
              aria-live="polite"
            >
              That&rsquo;s every listing — {resultCount} {resultCount === 1 ? "match" : "matches"} on iShim.
            </p>
          )}
        </>
      ) : (
        <EmptyState
          icon={SearchX}
          title={
            business
              ? "No business spaces match your filters"
              : "No listings match your filters"
          }
          description={
            settings
              ? "Try widening your budget or choosing another block — new listings are added every week."
              : "Try clearing filters and searching again."
          }
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      )}

      {/* ── Nearby wards strip (single block selected, not proximity mode) ── */}
      {!nearOn && !loading && !error && nearbyListings.length > 0 ? (
        <section aria-label="Nearby listings" className="mt-10">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Nearby {nearbyBlocks.length > 0 ? `· ${nearbyBlocks.join(" · ")}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground">
              Closest wards to {filters.block}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {nearbyListings.map((p) => (
              <PropertyCard key={`nearby-${p.id}`} property={p} showMode={everything} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
