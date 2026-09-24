"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CalendarCheck2,
  Handshake,
  House,
  Inbox,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  RotateCcw,
  Store,
  Trash2,
  Undo2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./empty-state";
import { AreaRequestsCard } from "./area-requests-card";
import { WardManager } from "./ward-manager";
import { Photo } from "./photo";
import { WaTemplateDialog } from "./wa-template-dialog";
import { useStore } from "@/lib/store";
import { leadsApi, type ListingLeadItem } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { formatDate, formatRent } from "@/lib/types";
import { LEAD_DEFAULT_KEY, LEAD_TEMPLATES, renderTemplates } from "@/lib/wa-templates";

/**
 * IntakeTab — the agent worklist for NO-ACCOUNT listing requests.
 * Locals send the quick-list form (or WhatsApp); the agent claims the
 * request, calls back, takes photos, creates the real listing from the
 * standard form, then marks the lead LISTED. This is the human half of
 * "they only want something to reach the agent".
 */

const STATUS_FILTERS = [
  { key: "OPEN", label: "To handle" },
  { key: "LISTED", label: "Listed" },
  { key: "DISCARDED", label: "Discarded" },
  { key: "ALL", label: "All" },
] as const;

const STATUS_STYLES: Record<ListingLeadItem["status"], string> = {
  NEW: "bg-primary/10 text-primary border-primary/20",
  CLAIMED: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  LISTED: "bg-secondary text-secondary-foreground border-transparent",
  DISCARDED: "bg-muted text-muted-foreground border-transparent",
};

export function IntakeTab() {
  const user = useStore((s) => s.user);
  const settings = useStore((s) => s.settings);
  const openListing = useStore((s) => s.openListing);
  const bumpListings = useStore((s) => s.bumpListings);

  const [status, setStatus] = useState<string>("OPEN");
  const [rows, setRows] = useState<ListingLeadItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waLead, setWaLead] = useState<ListingLeadItem | null>(null);

  const load = useCallback(() => {
    setError(null);
    leadsApi
      .list(status)
      .then((d) => {
        setRows(d.items);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load intake requests"));
  }, [status]);

  useEffect(() => {
    // Off the effect body (react-hooks/set-state-in-effect): load clears
    // error state synchronously, so schedule it instead of calling directly.
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const act = async (id: string, action: "claim" | "release" | "discard" | "markListed" | "reopen") => {
    if (busyId) return;
    setBusyId(id);
    try {
      const { lead } = await leadsApi.act(id, action);
      // Optimistic swap keeps the list calm; refetch keeps it honest.
      setRows((list) => (list ?? []).map((r) => (r.id === id ? lead : r)));
      if (status !== "OPEN" && status !== "ALL") {
        // Status views should drop the row that no longer belongs.
        setRows((list) => (list ?? []).filter((r) => r.id !== id || r.status === status));
      }
      if (action === "markListed") bumpListings();
      toastSuccess(
        action === "claim" ? "Request claimed" : action === "markListed" ? "Marked as listed" : "Updated",
        action === "claim"
          ? "Call or WhatsApp them now — photos, then the listing form."
          : undefined
      );
      load();
    } catch (e) {
      toastError(e, "Could not update the request");
    } finally {
      setBusyId(null);
    }
  };

  if (error) {
    return (
      <EmptyState icon={Inbox} title="Couldn't load intake requests" description={error} actionLabel="Retry" onAction={load} />
    );
  }

  return (
    <div className="space-y-3">
      {/* Areas people typed because they weren't on the list — add with one tap */}
      <AreaRequestsCard />

      {/* The official ward list + their photos — agents manage areas too */}
      <WardManager />

      {/* Status filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 thin-scrollbar" role="group" aria-label="Filter intake requests by status">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={status === f.key}
            onClick={() => setStatus(f.key)}
            className={cn(
              "min-h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              status === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={status === "OPEN" ? "No requests waiting" : "Nothing here"}
          description={
            status === "OPEN"
              ? "When someone lists a place without an account (quick form or WhatsApp), their request lands here for you to handle."
              : "Nothing matches this filter right now."
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {rows.length} request{rows.length === 1 ? "" : "s"} — claim one, call them, take photos,
            then create the listing.
          </p>
          <ul className="space-y-2.5">
            {rows.map((lead) => {
              const mine = lead.claimedBy && user && lead.claimedBy.name === user.name;
              return (
                <li key={lead.id}>
                  <article className="rounded-2xl border bg-card p-4 shadow-sm" aria-label={`Listing request from ${lead.name}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className={cn("rounded-full border", STATUS_STYLES[lead.status])}>
                        {lead.status === "NEW" ? "New request" : lead.status === "CLAIMED" ? "Claimed" : lead.status === "LISTED" ? "Listed" : "Discarded"}
                      </Badge>
                      <Badge variant="outline" className="gap-1 rounded-full">
                        {lead.mode === "BUSINESS" ? <Store className="size-3" aria-hidden /> : <House className="size-3" aria-hidden />}
                        {lead.mode === "BUSINESS" ? "Shop / office" : "Home"}
                      </Badge>
                      <span className="ml-auto text-xs text-muted-foreground">{formatDate(lead.createdAt)}</span>
                    </div>

                    <div className="mt-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {lead.block || "Area not set"}
                          {lead.rent && lead.rent > 0 ? ` · expects ${formatRent(lead.rent)}/mo` : " · rent open"}
                        </p>
                        {lead.block && settings && !settings.blocks.includes(lead.block) ? (
                          <Badge
                            variant="outline"
                            className="mt-1 gap-1 rounded-full border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          >
                            <MapPin className="size-3" aria-hidden />
                            New area — add it above
                          </Badge>
                        ) : null}
                      </div>
                      <a
                        href={`tel:${lead.phone}`}
                        className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
                      >
                        {lead.phone}
                      </a>
                    </div>

                    {lead.photos?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2" aria-label="Photos shared by the requester">
                        {lead.photos.map((p, i) => (
                          <a
                            key={p}
                            href={p}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block size-16 overflow-hidden rounded-lg border bg-secondary"
                            aria-label={`Open photo ${i + 1} in a new tab`}
                          >
                            <Photo src={p} alt="" className="h-full w-full" />
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {lead.details ? (
                      <p className="mt-2 rounded-xl bg-muted/50 px-3 py-2.5 text-sm leading-relaxed text-foreground/80">
                        “{lead.details}”
                      </p>
                    ) : null}

                    {lead.claimedBy ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {lead.status === "CLAIMED" ? "Claimed by " : "Handled by "}
                        <span className="font-medium text-foreground/80">
                          {lead.claimedBy.name}
                          {mine ? " (you)" : ` (${lead.claimedBy.role.toLowerCase()})`}
                        </span>
                      </p>
                    ) : null}

                    <div className="mt-3 grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      <Button asChild variant="outline" size="sm" className="min-h-10 rounded-full">
                        <a href={`tel:${lead.phone}`}>
                          <Phone aria-hidden /> Call
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-10 rounded-full"
                        onClick={() => setWaLead(lead)}
                      >
                        <MessageCircle aria-hidden /> WhatsApp
                      </Button>
                      {!lead.claimedById && lead.status === "NEW" ? (
                        <Button
                          size="sm"
                          className="col-span-2 min-h-10 rounded-full sm:col-span-1"
                          onClick={() => act(lead.id, "claim")}
                          disabled={busyId === lead.id}
                        >
                          {busyId === lead.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Handshake aria-hidden />}
                          Claim & handle
                        </Button>
                      ) : null}
                      {mine && lead.status !== "LISTED" ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="min-h-10 rounded-full"
                            onClick={() => {
                              openListing();
                            }}
                          >
                            <CalendarCheck2 aria-hidden /> Open listing form
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-10 rounded-full"
                            onClick={() => act(lead.id, "markListed")}
                            disabled={busyId === lead.id}
                          >
                            {busyId === lead.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check aria-hidden />}
                            Mark listed
                          </Button>
                        </>
                      ) : null}
                      {mine && lead.status !== "LISTED" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-10 rounded-full text-muted-foreground"
                          onClick={() => act(lead.id, "release")}
                          disabled={busyId === lead.id}
                        >
                          <Undo2 aria-hidden /> Release
                        </Button>
                      ) : null}
                      {lead.status === "NEW" && !lead.claimedById ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="col-span-2 min-h-10 rounded-full text-muted-foreground sm:col-span-1"
                          onClick={() => act(lead.id, "discard")}
                          disabled={busyId === lead.id}
                        >
                          <Trash2 aria-hidden /> Discard
                        </Button>
                      ) : null}
                      {lead.status === "LISTED" || lead.status === "DISCARDED" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-10 rounded-full text-muted-foreground"
                          onClick={() => act(lead.id, "reopen")}
                          disabled={busyId === lead.id}
                        >
                          <RotateCcw aria-hidden /> Reopen
                        </Button>
                      ) : null}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {waLead ? (
        <WaTemplateDialog
          open
          onOpenChange={(v) => {
            if (!v) setWaLead(null);
          }}
          phone={waLead.phone}
          name={waLead.name}
          templates={renderTemplates(LEAD_TEMPLATES, {
            name: waLead.name,
            mode: waLead.mode === "BUSINESS" ? "BUSINESS" : "HOME",
            block: waLead.block,
            rent: waLead.rent,
            agentName: user?.name ?? "iShim",
          })}
          defaultKey={LEAD_DEFAULT_KEY[waLead.status]}
        />
      ) : null}
    </div>
  );
}
