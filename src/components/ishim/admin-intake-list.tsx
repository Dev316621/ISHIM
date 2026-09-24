"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, House, Inbox, MapPin, MessageCircle, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./empty-state";
import { Photo } from "./photo";
import { WaTemplateDialog } from "./wa-template-dialog";
import { leadsApi, type ListingLeadItem } from "@/lib/api";
import { toastError } from "@/lib/feedback";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatDate, formatRent } from "@/lib/types";
import { LEAD_DEFAULT_KEY, LEAD_TEMPLATES, renderTemplates } from "@/lib/wa-templates";

/**
 * AdminIntakeList — read-only god-view of every no-account listing
 * request (the agent intake queue). Admins can see who claimed what;
 * actions are left to the agents. Mirrors the "admin knows every lead"
 * requirement for the quick-list funnel.
 */

const STATUS_STYLES: Record<ListingLeadItem["status"], string> = {
  NEW: "bg-primary/10 text-primary border-primary/20",
  CLAIMED: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  LISTED: "bg-secondary text-secondary-foreground border-transparent",
  DISCARDED: "bg-muted text-muted-foreground border-transparent",
};

export function AdminIntakeList() {
  const user = useStore((s) => s.user);
  const settings = useStore((s) => s.settings);
  const [rows, setRows] = useState<ListingLeadItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waLead, setWaLead] = useState<ListingLeadItem | null>(null);

  const load = useCallback(() => {
    setError(null);
    leadsApi
      .list("ALL")
      .then((d) => setRows(d.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load listing requests"));
  }, []);

  useEffect(() => {
    // Off the effect body (react-hooks/set-state-in-effect): load clears
    // error state synchronously, so schedule it instead of calling directly.
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  if (error) {
    return (
      <EmptyState icon={Inbox} title="Couldn't load listing requests" description={error} actionLabel="Retry" onAction={load} />
    );
  }

  if (rows === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No listing requests yet"
        description="Quick-list submissions from people without accounts will appear here as they arrive."
      />
    );
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {rows.length} no-account listing request{rows.length === 1 ? "" : "s"} — handled by agents
        in the Intake queue.
      </p>
      <ul className="space-y-2.5">
        {rows.map((lead) => (
          <li key={lead.id}>
            <article className="rounded-2xl border bg-card p-4 shadow-sm" aria-label={`Listing request from ${lead.name}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={cn("rounded-full border", STATUS_STYLES[lead.status])}>
                  {lead.status === "NEW"
                    ? "Unclaimed"
                    : lead.status === "CLAIMED"
                      ? "Claimed"
                      : lead.status === "LISTED"
                        ? "Listed"
                        : "Discarded"}
                </Badge>
                <Badge variant="outline" className="gap-1 rounded-full">
                  {lead.mode === "BUSINESS" ? <Building2 className="size-3" aria-hidden /> : <House className="size-3" aria-hidden />}
                  {lead.mode === "BUSINESS" ? "Business" : "Home"}
                </Badge>
                {lead.source !== "FORM" ? (
                  <Badge variant="outline" className="rounded-full">{lead.source}</Badge>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">{formatDate(lead.createdAt)}</span>
              </div>

              <p className="mt-1.5 text-sm font-medium">
                {lead.name} <span className="font-normal text-muted-foreground">· {lead.phone}</span>
              </p>
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
                  New area — pending in Settings
                </Badge>
              ) : null}
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
                <p className="mt-2 rounded-xl bg-muted/50 px-3 py-2 text-sm leading-relaxed text-foreground/80">“{lead.details}”</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {lead.claimedBy ? (
                  <>
                    Handled by <span className="font-medium text-foreground/80">{lead.claimedBy.name}</span>
                    {lead.propertyId ? " · listing published" : ""}
                  </>
                ) : (
                  "Waiting for an agent to claim it"
                )}
              </p>
              <div className="mt-3 flex gap-2">
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
              </div>
            </article>
          </li>
        ))}
      </ul>

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
    </>
  );
}
