"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Handshake,
  House,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Users,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./empty-state";
import { useStore } from "@/lib/store";
import { publicApi } from "@/lib/api";
import { toastError } from "@/lib/feedback";
import {
  formatPhoneDisplay,
  formatRent,
  normalizePhoneE164,
  typeLabel,
  type DirectoryProfile,
  type DirectoryResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type DirTab = "ALL" | "OWNER" | "AGENT";

const TABS: { key: DirTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "OWNER", label: "Owners" },
  { key: "AGENT", label: "Agents" },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function memberSinceLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/** Tiny available / rented pill used on the mini listing rows. */
function ListingStatusPill({ status }: { status: string }) {
  const rented = status !== "ACTIVE";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        rented
          ? "bg-muted text-muted-foreground"
          : "bg-primary/10 text-primary"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          rented ? "bg-muted-foreground/60" : "animate-pulse bg-primary"
        )}
        aria-hidden
      />
      {rented ? "Rented" : "Available"}
    </span>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Icon className="size-4 text-primary" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold leading-tight tabular-nums">
          {value}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {label}
        </span>
      </span>
    </div>
  );
}

/** One owner / agent profile card: identity, contact, blocks, listings. */
function DirectoryCard({ profile }: { profile: DirectoryProfile }) {
  const openProperty = useStore((s) => s.openProperty);

  const waHref = profile.whatsapp
    ? `https://wa.me/${normalizePhoneE164(profile.whatsapp)}?text=${encodeURIComponent(
        `Hi ${profile.name}, I found you on iShim. I'm looking for a home in Ukhrul.`
      )}`
    : null;
  const telHref = profile.phone
    ? `tel:+${normalizePhoneE164(profile.phone)}`
    : null;

  const isAgent = profile.role === "AGENT";

  return (
    <article className="flex min-w-0 flex-col rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
      {/* Identity */}
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl font-semibold",
            isAgent
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-primary"
          )}
        >
          {initials(profile.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <h2 className="truncate font-semibold tracking-tight">
              {profile.name}
            </h2>
            {profile.verified ? (
              <span
                title="Verified by iShim"
                className="inline-flex items-center"
              >
                <BadgeCheck className="size-4 text-primary" aria-hidden />
                <span className="sr-only">Verified</span>
              </span>
            ) : null}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                isAgent
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-primary"
              )}
            >
              {isAgent ? (
                <Briefcase className="size-3" aria-hidden />
              ) : (
                <House className="size-3" aria-hidden />
              )}
              {isAgent ? "Agent" : "Owner"}
            </span>
            {profile.managedBy ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                title={`Onboarded & maintained by ${profile.managedBy.name}`}
              >
                <Handshake className="size-3" aria-hidden />
                Managed by {profile.managedBy.name}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            On iShim since {memberSinceLabel(profile.memberSince)}
          </p>
        </div>
      </header>

      {/* Track record — listed / available / successfully rented */}
      <div className="mt-3 grid grid-cols-3 gap-2" aria-label={`Track record for ${profile.name}`}>
        <div className="rounded-2xl border bg-background px-3 py-2 text-center">
          <p className="text-lg font-semibold leading-tight tabular-nums">
            {profile.stats.total}
          </p>
          <p className="text-[11px] text-muted-foreground">Listed</p>
        </div>
        <div className="rounded-2xl border bg-background px-3 py-2 text-center">
          <p className="text-lg font-semibold leading-tight tabular-nums text-primary">
            {profile.stats.available}
          </p>
          <p className="text-[11px] text-muted-foreground">Available</p>
        </div>
        <div className="rounded-2xl border bg-background px-3 py-2 text-center">
          <p className="flex items-center justify-center gap-1 text-lg font-semibold leading-tight tabular-nums">
            {profile.stats.rented}
            {profile.stats.rented > 0 ? (
              <BadgeCheck className="size-4 text-primary" aria-hidden />
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground">Rented ✓</p>
        </div>
      </div>

      {/* Blocks / wards they operate in */}
      <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
        <MapPin
          className="mt-0.5 size-4 shrink-0 text-primary/70"
          aria-hidden
        />
        <span className="min-w-0">
          {profile.blocks.length ? (
            <>
              <span className="sr-only">Operates in </span>
              {profile.blocks.join(" · ")}
            </>
          ) : (
            "New on iShim — no live listings yet"
          )}
        </span>
      </p>

      {/* Direct contact */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-secondary/60 p-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Phone className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate tabular-nums">
            {formatPhoneDisplay(profile.phone)}
          </span>
        </span>
        <span className="ms-auto flex shrink-0 items-center gap-2">
          {waHref ? (
            <Button asChild size="sm" className="h-9 rounded-full px-3.5">
              <a
                href={waHref}
                target="_blank"
                rel="noopener,noreferrer"
                aria-label={`WhatsApp ${profile.name}`}
              >
                <MessageCircle aria-hidden />
                WhatsApp
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              disabled
              className="h-9 rounded-full px-3.5"
              title="No WhatsApp number on file"
            >
              <MessageCircle aria-hidden />
              WhatsApp
            </Button>
          )}
          {telHref ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-9 rounded-full px-3.5"
            >
              <a
                href={telHref}
                aria-label={`Call ${profile.name}`}
              >
                <Phone aria-hidden />
                Call
              </a>
            </Button>
          ) : null}
        </span>
      </div>

      {/* Their listed rentals */}
      <section aria-label={`Listings by ${profile.name}`} className="mt-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          Listed rentals
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {profile.listings.length}
          </span>
        </h3>
        {profile.listings.length ? (
          <ul className="max-h-72 space-y-2 overflow-y-auto thin-scrollbar pr-1">
            {profile.listings.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => openProperty(p.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border bg-background p-2 text-left transition hover:border-primary/30 hover:bg-secondary/50"
                >
                  {p.photos[0] ? (
                    <img
                      src={p.photos[0]}
                      alt=""
                      loading="lazy"
                      className="size-14 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary"
                    >
                      <House className="size-5 text-primary/50" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {p.block} ·{" "}
                      {typeLabel(p)} ·{" "}
                      {p.mode === "BUSINESS"
                        ? p.areaSqft
                          ? `${p.areaSqft.toLocaleString("en-IN")} sq ft`
                          : "space"
                        : `${p.bedrooms} BHK`}
                      {p.listedByAgentId ? " · agent-listed" : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold">
                      {formatRent(p.rent)}
                      <span className="text-xs font-normal text-muted-foreground">
                        /mo
                      </span>
                    </span>
                    <ListingStatusPill status={p.status ?? "ACTIVE"} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed px-3 py-3 text-sm text-muted-foreground">
            No live listings right now — reach out directly, new homes may be
            on the way.
          </p>
        )}
      </section>
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-14 rounded-2xl" />
    </div>
  );
}

/** /directory — "Know your Owners": every registered owner & agent. */
export function DirectoryView() {
  const setView = useStore((s) => s.setView);
  // Pre-filled name search (universal search → person suggestion).
  const directoryQuery = useStore((s) => s.directoryQuery);
  const setDirectoryQuery = useStore((s) => s.setDirectoryQuery);

  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DirTab>("ALL");
  const [q, setQ] = useState(directoryQuery);

  // Consume the hand-off so revisits start clean.
  useEffect(() => {
    if (directoryQuery) setDirectoryQuery("");
  }, [directoryQuery, setDirectoryQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await publicApi.getDirectory();
      setData(res);
    } catch (err) {
      setData(null);
      toastError(err, "Couldn't load the directory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const profiles = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.profiles.filter((p) => {
      if (tab !== "ALL" && p.role !== tab) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        p.blocks.some((b) => b.toLowerCase().includes(needle))
      );
    });
  }, [data, tab, q]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView("home")}
          className="-ml-2 mb-3 gap-1.5 rounded-full text-muted-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"
          >
            <Users className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Know your Owners
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Every owner here is onboarded and looked after by an iShim
              agent — see their live listings, areas and track record
              (listed, available and successfully rented), then reach out
              directly.
            </p>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[68px] rounded-2xl" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Users} value={data.summary.owners} label="Owners" />
          <StatTile icon={Briefcase} value={data.summary.agents} label="Agents" />
          <StatTile icon={House} value={data.summary.listings} label="Listings" />
          <StatTile
            icon={BadgeCheck}
            value={data.summary.successes}
            label="Successfully rented"
          />
        </div>
      ) : null}

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Filter directory by role"
          className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition",
                tab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or block…"
            aria-label="Search owners and agents by name or block"
            className="h-11 rounded-full pl-10"
          />
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2" aria-hidden>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : !data ? (
        <EmptyState
          icon={WifiOff}
          title="Couldn't load the directory"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => void load()}
          className="mt-5"
        />
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No profiles match"
          description={
            q.trim()
              ? `Nothing found for "${q.trim()}". Try another name or block.`
              : "No owners or agents registered under this filter yet."
          }
          className="mt-5"
        />
      ) : (
        <>
          <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
            {profiles.length} {profiles.length === 1 ? "profile" : "profiles"}
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {profiles.map((p) => (
              <DirectoryCard key={p.id} profile={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
