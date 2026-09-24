"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Eye,
  Handshake,
  Home,
  MessageCircle,
  Plus,
  Store,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingsList } from "./listings-list";
import { PaymentDialog } from "./payment-dialog";
import { EnquiriesInbox } from "./enquiries-inbox";
import { EmptyState } from "./empty-state";
import { AskAgentDialog } from "./ask-agent-dialog";
import { VerticalSwitch } from "./vertical-switch";
import { useStore } from "@/lib/store";
import { ownerApi } from "@/lib/api";
import {
  type Property,
} from "@/lib/types";

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
        <Icon className="size-5 text-primary" aria-hidden />
      </div>
      <p className="mt-2.5 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function OwnerDashboard() {
  const user = useStore((s) => s.user);
  const listingsVersion = useStore((s) => s.listingsVersion);
  const openListing = useStore((s) => s.openListing);
  const paymentDialog = useStore((s) => s.paymentDialog);
  const setPaymentDialog = useStore((s) => s.setPaymentDialog);
  const goSearch = useStore((s) => s.goSearch);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);

  const [properties, setProperties] = useState<Property[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askAgentOpen, setAskAgentOpen] = useState(false);

  const load = useCallback(() => {
    ownerApi
      .getMyProperties()
      .then((data) => {
        setProperties(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load listings"));
  }, []);

  useEffect(() => {
    load();
  }, [load, listingsVersion]);

  if (error) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load your listings"
        description={error}
        actionLabel="Retry"
        onAction={load}
      />
    );
  }

  if (properties === null) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-11 w-40 rounded-full" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  const businessCount = properties.filter((p) => p.mode === "BUSINESS").length;
  const homeCount = properties.length - businessCount;
  // Panel discretion — the active vertical's listings only.
  const filtered = properties.filter((p) =>
    mode === "BUSINESS" ? p.mode === "BUSINESS" : p.mode !== "BUSINESS"
  );
  const active = filtered.filter((p) => p.status === "ACTIVE").length;
  const panelViews = filtered.reduce((a, p) => a + (p.views ?? 0), 0);
  const panelClicks = filtered.reduce((a, p) => a + (p.whatsappClicks ?? 0), 0);
  const business = mode === "BUSINESS";

  return (
    <div className="space-y-6">
      {/* iShim ⇄ iShim Business panel discretion */}
      <div className="flex flex-col gap-3 rounded-3xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">
            {business ? "iShim Business" : "iShim"} — Owner dashboard
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Same dashboard, two panels — flip between homes and
            shops, offices &amp; cafes.
          </p>
        </div>
        <VerticalSwitch
          value={mode}
          onChange={setMode}
          size="md"
          counts={{ HOME: homeCount, BUSINESS: businessCount }}
          label="Owner panel — homes or business"
          className="sm:w-72"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Eye} label="Panel views" value={panelViews} />
        <StatCard icon={MessageCircle} label="WhatsApp clicks" value={panelClicks} />
        <StatCard
          icon={business ? Store : Home}
          label={business ? "Active spaces" : "Active homes"}
          value={active}
        />
      </div>

      {!user?.verified ? (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Your owner account is not verified yet. Visit the iShim office with your ID or a
          ward member reference to get the green Verified badge — verified homes get more
          enquiries.
        </p>
      ) : (
        <p className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground">
          <BadgeCheck className="size-4 text-primary" aria-hidden />
          Verified owner — your listings show the green trust badge.
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-3xl border border-primary/20 bg-secondary/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background"
          >
            <Handshake className="size-5 text-primary" />
          </span>
          <div>
            <p className="font-semibold tracking-tight">
              Can&apos;t list it yourself?
            </p>
            <p className="mt-0.5 max-w-md text-sm text-muted-foreground">
              Ask an iShim agent to do it for you — they&apos;ll call or WhatsApp
              you, take the details and photos, list your home, and keep it
              maintained until it rents.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setAskAgentOpen(true)}
          className="h-11 shrink-0 rounded-full"
        >
          <Handshake aria-hidden />
          Ask an agent
        </Button>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold tracking-tight">Enquiries &amp; visit bookings</h2>
        </div>
        <EnquiriesInbox mode={mode} />
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold tracking-tight">
            Your {business ? "business listings" : "homes"}
          </h2>
          <Button onClick={() => openListing()} className="rounded-full">
            <Plus aria-hidden /> Add {business ? "Business" : "Home"}
          </Button>
        </div>
        <ListingsList properties={filtered} onEdit={openListing} />
      </div>

      {filtered.length === 0 && properties.length > 0 ? (
        <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          Nothing in this panel yet — switch to the other panel to see your
          other listings.
        </p>
      ) : null}
      {properties.length === 0 ? (
        <Button variant="secondary" onClick={() => goSearch()} className="rounded-full">
          See what other {business ? "spaces" : "homes"} look like
        </Button>
      ) : null}

      <PaymentDialog
        open={!!paymentDialog}
        onOpenChange={(v) => {
          if (!v) setPaymentDialog(null);
        }}
        propertyId={paymentDialog?.propertyId ?? ""}
        propertyTitle={paymentDialog?.title ?? ""}
        fee={paymentDialog?.fee ?? 0}
        onPaid={load}
      />

      <AskAgentDialog open={askAgentOpen} onOpenChange={setAskAgentOpen} />
    </div>
  );
}
