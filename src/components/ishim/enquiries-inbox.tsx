"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck,
  MessageSquareText,
  MessageCircle,
  Phone,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Photo } from "./photo";
import { WaTemplateDialog } from "./wa-template-dialog";
import { enquiryApi } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/feedback";
import { useStore } from "@/lib/store";
import {
  ENQUIRY_STATUS_LABELS,
  formatDate,
  formatRent,
  type EnquiryStatus,
  type ListingMode,
  type MyEnquiry,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { ENQUIRY_DEFAULT_KEY, ENQUIRY_TEMPLATES, renderTemplates } from "@/lib/wa-templates";

const STATUS_ORDER: EnquiryStatus[] = ["NEW", "CONTACTED", "SCHEDULED", "CLOSED"];

function statusBadgeClass(s: EnquiryStatus): string {
  switch (s) {
    case "NEW":
      return "border-primary/30 bg-primary/10 text-primary";
    case "CONTACTED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "SCHEDULED":
      return "border-sky-200 bg-sky-50 text-sky-800";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function formatSlot(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

/**
 * Enquiries inbox for the routed handler (owner or agent).
 * Shows agent enquiries and inspection-visit bookings with status management.
 * Optional `mode` scopes the inbox to one vertical (iShim ⇄ iShim Business).
 */
export function EnquiriesInbox({ mode }: { mode?: ListingMode }) {
  const user = useStore((s) => s.user);
  const [enquiries, setEnquiries] = useState<MyEnquiry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [waEnq, setWaEnq] = useState<MyEnquiry | null>(null);

  const load = useCallback(() => {
    enquiryApi
      .getInbox()
      .then((res) => {
        setEnquiries(res.enquiries);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load enquiries"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: EnquiryStatus) => {
    setBusyId(id);
    const prev = enquiries;
    setEnquiries((rows) => rows?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    try {
      await enquiryApi.update(id, { status });
      toastSuccess(`Marked “${ENQUIRY_STATUS_LABELS[status]}”`);
    } catch (e) {
      setEnquiries(prev ?? null);
      toastError(e, "Could not update the enquiry");
    } finally {
      setBusyId(null);
    }
  };

  const visible =
    enquiries === null
      ? null
      : mode
        ? enquiries.filter((e) => (e.property.mode ?? "HOME") === mode)
        : enquiries;

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={load} className="mt-3 rounded-full">
          <RefreshCw aria-hidden /> Retry
        </Button>
      </div>
    );
  }

  if (visible === null) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  const openCount = visible.filter((e) => e.status === "NEW").length;

  return (
    <div className="space-y-3">
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No enquiries yet — when someone asks about your
          {mode === "BUSINESS" ? " business spaces" : " homes"} or books a visit,
          it lands here.
        </p>
      ) : (
        visible.map((e) => (
          <article
            key={e.id}
            className="rounded-2xl border bg-card p-4 shadow-sm"
            aria-label={`Enquiry from ${e.name} about ${e.property.title}`}
          >
            <div className="flex gap-3">
              <div className="relative hidden h-16 w-20 shrink-0 overflow-hidden rounded-xl sm:block">
                <Photo src={e.property.photos?.[0] ?? null} alt="" className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("rounded-full", statusBadgeClass(e.status))}>
                    {ENQUIRY_STATUS_LABELS[e.status]}
                  </Badge>
                  {e.kind === "VISIT" ? (
                    <Badge variant="outline" className="gap-1 rounded-full">
                      <CalendarCheck className="size-3" aria-hidden />
                      Visit · {formatSlot(e.visitAt)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 rounded-full">
                      <MessageSquareText className="size-3" aria-hidden />
                      Enquiry
                    </Badge>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDate(e.createdAt)}
                  </span>
                </div>

                <p className="truncate text-sm font-medium">{e.property.title}</p>
                <p className="text-xs text-muted-foreground">
                  {e.property.block} · {formatRent(e.property.rent)}/mo
                </p>

                <p className="text-sm">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-muted-foreground"> · {e.phone}</span>
                </p>

                {e.message ? (
                  <p className="rounded-xl bg-secondary/60 px-3 py-2 text-sm leading-relaxed text-secondary-foreground">
                    “{e.message}”
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <Button asChild variant="outline" size="sm" className="h-9 rounded-full">
                    <a href={`tel:${e.phone}`}>
                      <Phone aria-hidden /> Call
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full"
                    onClick={() => setWaEnq(e)}
                  >
                    <MessageCircle aria-hidden /> WhatsApp
                  </Button>
                  <div className="w-full sm:ml-auto sm:w-auto">
                    <Select
                      value={e.status}
                      onValueChange={(v) => setStatus(e.id, v as EnquiryStatus)}
                      disabled={busyId === e.id}
                    >
                      <SelectTrigger
                        aria-label="Update status"
                        className="h-10 w-full rounded-full text-xs sm:h-9 sm:w-[10.5rem]"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>
                            {ENQUIRY_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))
      )}
      {openCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {openCount} new {openCount === 1 ? "enquiry" : "enquiries"} waiting for a reply.
        </p>
      ) : null}

      {waEnq ? (
        <WaTemplateDialog
          open
          onOpenChange={(v) => {
            if (!v) setWaEnq(null);
          }}
          phone={waEnq.phone}
          name={waEnq.name}
          templates={renderTemplates(ENQUIRY_TEMPLATES, {
            name: waEnq.name,
            propertyTitle: waEnq.property.title,
            block: waEnq.property.block,
            agentName: user?.name ?? "iShim",
            kind: waEnq.kind === "VISIT" ? "VISIT" : "GENERAL",
          })}
          defaultKey={ENQUIRY_DEFAULT_KEY[waEnq.kind]}
        />
      ) : null}
    </div>
  );
}
