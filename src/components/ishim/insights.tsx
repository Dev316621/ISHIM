"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Eye,
  Heart,
  MessageCircle,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { adminApi, agentApi } from "@/lib/api";
import { HOUSE_TYPE_LABELS, type DemandSlice } from "@/lib/types";

// ─── Shared pieces ───────────────────────────────────────────────

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function BarList({
  title,
  items,
  format,
}: {
  title: string;
  items: DemandSlice[];
  format?: (label: string) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-sm font-semibold tracking-tight">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((it) => (
            <li key={it.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium">
                  {format ? format(it.label) : it.label}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{it.count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.max(6, (it.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InsightSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function Retry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">Couldn&apos;t load insights.</p>
      <Button variant="secondary" className="mt-3 rounded-full" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function fmtType(t: string) {
  return HOUSE_TYPE_LABELS[t] ?? t;
}

function fmtDay(iso: string) {
  return iso.slice(5); // MM-DD
}

// ─── Admin: renter-habit & demand report ─────────────────────────

type Report = Awaited<ReturnType<typeof adminApi.getInsights>>;

export function AdminInsightsTab() {
  const goSearch = useStore((s) => s.goSearch);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);

  const load = () => {
    adminApi
      .getInsights()
      .then((d) => {
        setReport(d);
        setError(false);
      })
      .catch(() => setError(true));
  };
  useEffect(load, []);

  const retry = () => {
    setError(false);
    load();
  };

  if (error) return <Retry onRetry={retry} />;
  if (!report) return <InsightSkeleton />;

  const maxDaily = Math.max(1, ...report.daily.map((d) => d.count));

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Activity} label="Events (30d)" value={report.totals.events} />
        <Stat icon={Search} label="Searches" value={report.totals.searches} />
        <Stat icon={Eye} label="Detail views" value={report.totals.views} />
        <Stat icon={Heart} label="Saves" value={report.totals.saves} />
        <Stat icon={MessageCircle} label="Contacts" value={report.totals.contacts} />
        <Stat icon={Users} label="Searchers" value={report.totals.uniqueSearchers} />
      </div>

      {/* Daily activity */}
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold tracking-tight">Activity — last 14 days</p>
        <div className="mt-4 flex h-28 items-end gap-1.5" aria-hidden>
          {report.daily.map((d) => (
            <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-primary/60 transition-colors group-hover:bg-primary"
                style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                title={`${d.date}: ${d.count}`}
              />
              <span className="text-[9px] text-muted-foreground">{fmtDay(d.date)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Demand vs supply */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold tracking-tight">Demand vs supply by block</p>
          <p className="text-xs text-muted-foreground">renter interest (30d) vs live listings</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Block</th>
                <th className="py-2 pr-3 font-medium">Demand</th>
                <th className="py-2 pr-3 font-medium">Live listings</th>
                <th className="py-2 font-medium">Signal</th>
              </tr>
            </thead>
            <tbody>
              {report.demandVsSupply.map((r) => (
                <tr key={r.block} className="border-b last:border-none">
                  <td className="py-2 pr-3 font-medium">
                    <button
                      type="button"
                      onClick={() => goSearch({ block: r.block })}
                      className="underline-offset-2 hover:underline"
                    >
                      {r.block}
                    </button>
                  </td>
                  <td className="py-2 pr-3">{r.demand}</td>
                  <td className="py-2 pr-3">{r.supply}</td>
                  <td className="py-2">
                    {r.demand > 0 && r.supply === 0 ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        Unmet demand
                      </span>
                    ) : r.demand > r.supply * 2 && r.supply > 0 ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-500">
                        Undersupplied
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top lists */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <BarList title="Top blocks searched" items={report.topBlocks} />
        <BarList title="Top house types" items={report.topTypes} format={fmtType} />
        <BarList title="Budget demand" items={report.priceBands} />
        <BarList title="Top search queries" items={report.topQueries} />
      </div>

      {/* Top searchers */}
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold tracking-tight">Most active searchers (30d)</p>
        {report.topSearchers.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Not enough activity yet — habits appear after a few searches.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Searcher</th>
                  <th className="py-2 pr-3 font-medium">Actions</th>
                  <th className="py-2 pr-3 font-medium">Top block</th>
                  <th className="py-2 pr-3 font-medium">Top type</th>
                  <th className="py-2 pr-3 font-medium">Max rent seen</th>
                  <th className="py-2 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {report.topSearchers.map((s) => (
                  <tr key={s.label} className="border-b last:border-none">
                    <td className="py-2 pr-3 font-medium">{s.label}</td>
                    <td className="py-2 pr-3">{s.events}</td>
                    <td className="py-2 pr-3">{s.topBlock}</td>
                    <td className="py-2 pr-3">{fmtType(s.topType)}</td>
                    <td className="py-2 pr-3">₹{s.maxRent.toLocaleString("en-IN")}</td>
                    <td className="py-2 text-muted-foreground">
                      {s.lastActive ? fmtDay(s.lastActive) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Guests are anonymized by device; signed-in searchers show name + masked phone.
        </p>
      </div>
    </div>
  );
}

// ─── Agent: demand snapshot + supply gaps ────────────────────────

type AgentDemand = Awaited<ReturnType<typeof agentApi.getDemand>>;

export function AgentInsightsTab() {
  const goSearch = useStore((s) => s.goSearch);
  const openListing = useStore((s) => s.openListing);
  const [data, setData] = useState<AgentDemand | null>(null);
  const [error, setError] = useState(false);

  const load = () => {
    agentApi
      .getDemand()
      .then((d) => {
        setData(d);
        setError(false);
      })
      .catch(() => setError(true));
  };
  useEffect(load, []);

  const retry = () => {
    setError(false);
    load();
  };

  if (error) return <Retry onRetry={retry} />;
  if (!data) return <InsightSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Activity} label="Renter events (30d)" value={data.demand.events} />
        <Stat icon={Search} label="Searches" value={data.demand.searches} />
        <Stat icon={MessageCircle} label="Owner contacts" value={data.demand.contacts} />
        <Stat icon={Sparkles} label="My active listings" value={data.myActiveListings} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <BarList title="Blocks renters want" items={data.demand.topBlocks} />
        <BarList title="Types renters want" items={data.demand.topTypes} format={fmtType} />
        <BarList title="Budget demand" items={data.demand.priceBands} />
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold tracking-tight">Where you&apos;re missing demand</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Blocks with the most renter interest and none/few of your listings.
        </p>
        {data.gaps.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No demand data yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.gaps.map((g) => (
              <li
                key={g.block}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed p-3",
                  g.mine === 0 && g.demand > 0 && "border-primary/40 bg-primary/5"
                )}
              >
                <div className="text-sm">
                  <span className="font-medium">{g.block}</span>
                  <span className="ml-2 text-muted-foreground">
                    {g.demand} renter {g.demand === 1 ? "action" : "actions"} ·{" "}
                    {g.mine === 0 ? "none of your listings" : `${g.mine} of yours`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-8 rounded-full"
                    onClick={() => goSearch({ block: g.block })}
                  >
                    <Search aria-hidden />
                    See homes
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-8 rounded-full"
                    onClick={() => openListing()}
                  >
                    List here
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
