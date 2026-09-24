"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  BadgeIndianRupee,
  CheckCircle2,
  DoorOpen,
  Heart,
  Home,
  House,
  KeyRound,
  LifeBuoy,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Photo } from "./photo";
import { EmptyState } from "./empty-state";
import { TenancyStatusPill } from "./tenancy-ui";
import { OwnerDashboard } from "./owner-dashboard";
import { AgentDashboard } from "./agent-dashboard";
import { AdminDashboard } from "./admin-dashboard";
import { useStore } from "@/lib/store";
import { authApi, clientApi, publicApi } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/feedback";
import { LANGS, useT } from "@/lib/i18n";
import {
  ROLE_LABELS,
  formatDate,
  formatRent,
  type Property,
  type TenanciesResponse,
  type Tenancy,
  type TenancyPropertyRef,
  type TenancyStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type HousingStatus = "looking" | "found";

function DashboardHeader() {
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const setView = useStore((s) => s.setView);

  if (!user) return null;

  const logout = async () => {
    try {
      await authApi.logout();
      setUser(null);
      setView("home");
      toastSuccess("Signed out", "See you soon on iShim.");
    } catch (e) {
      toastError(e, "Could not sign out");
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="flex items-center gap-1.5 font-semibold tracking-tight">
            {user.name}
            {user.verified ? (
              <BadgeCheck className="size-4.5 text-primary" aria-label="Verified" />
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">
            {ROLE_LABELS[user.role]} · {user.phone}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        onClick={logout}
        className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut aria-hidden /> Logout
      </Button>
    </div>
  );
}

function SavedHomes() {
  const savedIds = useStore((s) => s.savedIds);
  const goSearch = useStore((s) => s.goSearch);
  const openProperty = useStore((s) => s.openProperty);
  const toggleSavedLocal = useStore((s) => s.toggleSavedLocal);

  const [saved, setSaved] = useState<Property[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    clientApi
      .getSaved()
      .then((data) => {
        setSaved(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load saved homes"));
  }, []);

  useEffect(() => {
    load();
  }, [load, savedIds.length]);

  const unsave = async (p: Property) => {
    try {
      const res = await clientApi.toggleSaved(p.id);
      toggleSavedLocal(p.id, res.saved);
      setSaved((list) => (list ? list.filter((x) => x.id !== p.id) : list));
      toastSuccess("Removed from saved");
    } catch (e) {
      toastError(e, "Could not update saved homes");
    }
  };

  if (error) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load saved homes"
        description={error}
        actionLabel="Retry"
        onAction={load}
      />
    );
  }

  if (saved === null) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!saved.length) {
    return (
      <EmptyState
        icon={Heart}
        title="No saved homes yet"
        description="Tap the heart on any home to keep it here."
        actionLabel="Browse homes"
        onAction={() => goSearch()}
      />
    );
  }

  return (
    <ul className="max-h-96 space-y-2 overflow-y-auto thin-scrollbar pr-1">
      {saved.map((p) => (
        <li key={p.id}>
          <div className="flex items-center gap-3 rounded-2xl border bg-card p-2.5 transition-shadow hover:shadow-sm">
            <button
              type="button"
              onClick={() => openProperty(p.id)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
            >
              <Photo
                src={p.photos?.[0]}
                alt={p.title}
                className="h-16 w-20 shrink-0 rounded-xl"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.title}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" aria-hidden />
                  {p.block} · {formatRent(p.rent)}/mo
                </span>
              </span>
            </button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Remove ${p.title} from saved`}
              onClick={() => void unsave(p)}
              className="size-11 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
            >
              <Heart className="size-4.5 fill-primary text-primary" aria-hidden />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ContactHistory() {
  const recentContacts = useStore((s) => s.recentContacts);
  const clearRecentContacts = useStore((s) => s.clearRecentContacts);
  const openProperty = useStore((s) => s.openProperty);

  if (!recentContacts.length) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="No WhatsApp contact history yet"
        description="When you contact an owner, the home shows up here for quick reference."
      />
    );
  }

  return (
    <div className="space-y-2">
      <ul className="max-h-96 space-y-2 overflow-y-auto thin-scrollbar pr-1">
        {recentContacts.map((c) => (
          <li key={c.propertyId}>
            <button
              type="button"
              onClick={() => openProperty(c.propertyId)}
              className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                <MessageCircle className="size-4.5 text-primary" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.title}</span>
                <span className="text-xs text-muted-foreground">
                  {c.block} · {formatRent(c.rent)}/mo ·{" "}
                  {formatDate(c.at)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Stored on this device for your reference.</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={clearRecentContacts}
          className="h-8 rounded-full text-muted-foreground"
        >
          <Trash2 className="size-3.5" aria-hidden /> Clear
        </Button>
      </div>
    </div>
  );
}

/** Tappable 1–5 star input for rating the owner (hover preview on desktop). */
function StarRatingInput({
  value,
  onSelect,
  disabled,
}: {
  value: number | null;
  onSelect: (n: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || (value ?? 0);
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Rate the owner">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onSelect(n)}
          className="rounded-full p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          <Star
            aria-hidden
            className={cn(
              "size-6 transition-colors",
              n <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
      <span className="ml-1.5 text-xs text-muted-foreground" aria-hidden>
        {shown ? `${shown}/5` : "Tap to rate"}
      </span>
    </div>
  );
}

/** One stay: occupancy toggle, owner rating, remark for the next tenants. */
function StayCard({
  tenancy,
  onUpdated,
  onRemoved,
}: {
  tenancy: Tenancy;
  onUpdated: (t: Tenancy) => void;
  onRemoved: (id: string) => void;
}) {
  const openProperty = useStore((s) => s.openProperty);
  // Draft override for the remark: null = showing the server value. Kept
  // across status/rating saves so typing is never lost mid-edit.
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "status" | "rating" | "remark" | "remove">(null);

  const remark = draft ?? tenancy.remark ?? "";
  const dirty = remark.trim() !== (tenancy.remark ?? "");

  const setStatus = async (status: TenancyStatus) => {
    if (status === tenancy.status || busy) return;
    setBusy("status");
    try {
      const updated = await clientApi.updateTenancy(tenancy.id, { status });
      onUpdated(updated);
      toastSuccess(
        status === "STAYING" ? "Marked as still staying 🏠" : "Marked as moved out",
        status === "MOVED_OUT" ? "Leave a note below for the next tenants." : undefined
      );
    } catch (e) {
      toastError(e, "Could not update your stay");
    } finally {
      setBusy(null);
    }
  };

  const rate = async (n: number) => {
    if (busy) return;
    setBusy("rating");
    try {
      const updated = await clientApi.updateTenancy(tenancy.id, { ownerRating: n });
      onUpdated(updated);
      toastSuccess(
        `Owner rated ${n} star${n > 1 ? "s" : ""}`,
        "Shown on the home's page — your name stays private."
      );
    } catch (e) {
      toastError(e, "Could not save your rating");
    } finally {
      setBusy(null);
    }
  };

  const saveRemark = async () => {
    if (busy || !dirty) return;
    setBusy("remark");
    try {
      const updated = await clientApi.updateTenancy(tenancy.id, {
        remark: remark.trim() || null,
      });
      onUpdated(updated);
      setDraft(null); // back to server-authoritative view
      toastSuccess("Note saved", "Next tenants will see it on this home's page.");
    } catch (e) {
      toastError(e, "Could not save your note");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy("remove");
    try {
      await clientApi.deleteTenancy(tenancy.id);
      onRemoved(tenancy.id);
      toastSuccess("Stay removed");
    } catch (e) {
      toastError(e, "Could not remove this stay");
      setBusy(null);
    }
  };

  return (
    <article className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => openProperty(tenancy.property.id)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Photo
            src={tenancy.property.photos?.[0]}
            alt={tenancy.property.title}
            className="h-16 w-20 shrink-0 rounded-xl"
          />
          <span className="min-w-0">
            <span className="block truncate font-medium">{tenancy.property.title}</span>
            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden />
              {tenancy.property.block} · {formatRent(tenancy.property.rent)}/mo
            </span>
            <TenancyStatusPill status={tenancy.status} className="mt-1.5" />
          </span>
        </button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Remove ${tenancy.property.title} from your stays`}
          onClick={() => void remove()}
          disabled={busy !== null}
          className="size-11 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4.5" aria-hidden />
        </Button>
      </div>

      <div className="mt-4 space-y-4 border-t pt-4">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Do you still live here?
          </p>
          <div className="grid max-w-xs grid-cols-2 gap-1 rounded-full bg-secondary/70 p-1">
            {(
              [
                { key: "STAYING", label: "Still staying", Icon: Home },
                { key: "MOVED_OUT", label: "Moved out", Icon: DoorOpen },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={tenancy.status === key}
                disabled={busy !== null}
                onClick={() => void setStatus(key)}
                className={cn(
                  "flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  tenancy.status === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rate the owner
          </p>
          <StarRatingInput
            value={tenancy.ownerRating}
            onSelect={(n) => void rate(n)}
            disabled={busy !== null}
          />
        </div>

        <div>
          <label
            htmlFor={`remark-${tenancy.id}`}
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            A note for the next tenants
          </label>
          <Textarea
            id={`remark-${tenancy.id}`}
            value={remark}
            onChange={(e) => setDraft(e.target.value.slice(0, 500))}
            rows={3}
            maxLength={500}
            placeholder="Water timing, deposit return, power backup, landlord behaviour — what should the next tenant know?"
            className="rounded-2xl text-sm"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{remark.length}/500</span>
            <Button
              size="sm"
              onClick={() => void saveRemark()}
              disabled={!dirty || busy !== null}
              className="min-h-9 rounded-full"
            >
              {busy === "remark" ? "Saving…" : dirty ? "Save note" : "Saved"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Client-profile section: where I live(d), owner ratings, tenant notes. */
function MyStays() {
  const goSearch = useStore((s) => s.goSearch);
  const [data, setData] = useState<TenanciesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const load = useCallback(() => {
    clientApi
      .getTenancies()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load your stays")
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onUpdated = (t: Tenancy) =>
    setData((d) =>
      d ? { ...d, tenancies: d.tenancies.map((x) => (x.id === t.id ? t : x)) } : d
    );
  const onRemoved = (id: string) =>
    setData((d) => (d ? { ...d, tenancies: d.tenancies.filter((x) => x.id !== id) } : d));

  const addStay = async (p: TenancyPropertyRef) => {
    if (addingId) return;
    setAddingId(p.id);
    try {
      const t = await clientApi.createTenancy({ propertyId: p.id });
      setData((d) =>
        d
          ? {
              tenancies: [t, ...d.tenancies],
              contacted: d.contacted.filter((c) => c.id !== p.id),
            }
          : d
      );
      setPickerOpen(false);
      toastSuccess("Marked as your stay", "How is the owner? Leave a rating and a note.");
    } catch (e) {
      toastError(e, "Could not add this stay");
    } finally {
      setAddingId(null);
    }
  };

  if (error) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load your stays"
        description={error}
        actionLabel="Retry"
        onAction={load}
      />
    );
  }

  if (data === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-44 rounded-3xl" />
      </div>
    );
  }

  const picker = (
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a stay</DialogTitle>
          <DialogDescription>
            Homes you contacted on WhatsApp. Living somewhere not listed? Contact
            the owner from any home&apos;s page first.
          </DialogDescription>
        </DialogHeader>
        {data.contacted.length ? (
          <ul className="space-y-2">
            {data.contacted.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border p-2.5">
                <Photo
                  src={p.photos?.[0]}
                  alt={p.title}
                  className="h-14 w-[4.5rem] shrink-0 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.block} · {formatRent(p.rent)}/mo · contacted{" "}
                    {formatDate(p.contactedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="min-h-9 shrink-0 rounded-full"
                  disabled={addingId === p.id}
                  onClick={() => void addStay(p)}
                >
                  {addingId === p.id ? "Adding…" : "I live here"}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-6 text-center">
            <KeyRound className="mx-auto size-8 text-muted-foreground/50" aria-hidden />
            <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
              No contacted homes yet. Once you message an owner on WhatsApp, the
              home appears here so you can mark it as your stay.
            </p>
            <Button
              variant="outline"
              className="mt-4 rounded-full"
              onClick={() => {
                setPickerOpen(false);
                goSearch();
              }}
            >
              <Search aria-hidden /> Browse homes
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  if (!data.tenancies.length) {
    return (
      <>
        <EmptyState
          icon={KeyRound}
          title="Mark where you live(d)"
          description="Rate your owner and leave tips for the next tenants. Homes you contacted on WhatsApp can be added as a stay."
          actionLabel={data.contacted.length ? "Add a stay" : "Browse homes"}
          onAction={() =>
            data.contacted.length ? setPickerOpen(true) : goSearch()
          }
        />
        {picker}
      </>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.tenancies.length === 1
            ? "1 home — your owner rating and notes help everyone."
            : `${data.tenancies.length} homes — your ratings and notes help everyone.`}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="min-h-9 rounded-full"
          onClick={() => setPickerOpen(true)}
        >
          <Plus aria-hidden /> Add a stay
        </Button>
      </div>
      <div className="space-y-4">
        {data.tenancies.map((t) => (
          <StayCard
            key={t.id}
            tenancy={t}
            onUpdated={onUpdated}
            onRemoved={onRemoved}
          />
        ))}
      </div>
      {picker}
    </>
  );
}

function ClientDashboard() {
  const user = useStore((s) => s.user);
  const [status, setStatus] = useState<HousingStatus>("looking");

  if (!user) return null;

  const setStatusWithToast = (s: HousingStatus) => {
    setStatus(s);
    toastSuccess(
      s === "looking" ? "Still looking 🏡" : "Congrats on finding a home! 🎉",
      s === "looking"
        ? "We'll keep fresh homes coming your way."
        : "You can still browse — or list your old place if you're moving out."
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-secondary/60 p-5">
        <div>
          <p className="font-medium text-secondary-foreground">Housing status</p>
          <p className="text-sm text-muted-foreground">
            Helps agents prioritise your requests.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-card p-1 shadow-sm">
          {(
            [
              { key: "looking", label: "Looking" },
              { key: "found", label: "Found" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={status === key}
              onClick={() => setStatusWithToast(key)}
              className={cn(
                "flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                status === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {key === "found" ? (
                <CheckCircle2 className="size-4" aria-hidden />
              ) : (
                <Search className="size-4" aria-hidden />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      <section aria-label="My stays">
        <h2 className="mb-3 font-semibold tracking-tight">My stays</h2>
        <MyStays />
      </section>

      <section aria-label="Saved homes">
        <h2 className="mb-3 font-semibold tracking-tight">Saved homes</h2>
        <SavedHomes />
      </section>

      <section aria-label="Contact history">
        <h2 className="mb-3 font-semibold tracking-tight">Contact history</h2>
        <ContactHistory />
      </section>
    </div>
  );
}

/** One tappable tile in the More hub. */
function MoreTile({
  icon: Icon,
  label,
  sub,
  onClick,
}: {
  icon: typeof Heart;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-24 flex-col items-start gap-2 rounded-2xl border bg-card p-3.5 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-secondary">
        <Icon className="size-4 text-primary" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}

function GuestCard() {
  const savedIds = useStore((s) => s.savedIds);
  const toggleSavedLocal = useStore((s) => s.toggleSavedLocal);
  const openProperty = useStore((s) => s.openProperty);
  const goSearch = useStore((s) => s.goSearch);
  const openAuth = useStore((s) => s.openAuth);
  const setView = useStore((s) => s.setView);
  const openHelp = useStore((s) => s.openHelp);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const t = useT();
  const savedCount = savedIds.length;

  const [snips, setSnips] = useState<Record<string, Property | "GONE"> | null>(null);

  // Fetch the public card for each device-saved home (small n; runs only
  // when the guest opens their profile). Off the effect body via setTimeout
  // because both branches set state synchronously.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!savedIds.length) {
        setSnips({});
        return;
      }
      setSnips(null);
      Promise.all(
        savedIds.map((id) =>
          publicApi
            .getProperty(id)
            .then((p) => [id, p] as const)
            .catch(() => [id, "GONE"] as const)
        )
      ).then((pairs) => {
        setSnips(Object.fromEntries(pairs));
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, [savedIds]);

  return (
    <div className="space-y-6">
      {/* Welcome — account-free by design */}
      <div className="flex flex-col items-center gap-3 rounded-3xl border bg-card px-6 py-8 text-center shadow-sm">
        <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
          <House className="size-6 text-primary" aria-hidden />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("more.welcome")}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {t("more.welcomeSub")}
          </p>
        </div>
      </div>

      {/* More hub — the things locals actually need */}
      <section aria-label="Quick actions">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <MoreTile
            icon={Heart}
            label={t("more.wishlist")}
            sub={savedCount > 0 ? `${savedCount} saved home${savedCount === 1 ? "" : "s"} on this device` : t("more.wishlistSub")}
            onClick={() => {
              document
                .getElementById("more-saved")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
          <MoreTile
            icon={Plus}
            label={t("more.list")}
            sub={t("more.listSub")}
            onClick={() => useStore.getState().openQuickList()}
          />
          <MoreTile
            icon={Search}
            label={t("more.find")}
            sub={t("more.findSub")}
            onClick={() => goSearch()}
          />
          <MoreTile
            icon={BadgeIndianRupee}
            label={t("more.pricing")}
            sub={t("more.pricingSub")}
            onClick={() => setView("pricing")}
          />
          <MoreTile
            icon={Users}
            label={t("more.owners")}
            sub={t("more.ownersSub")}
            onClick={() => setView("directory")}
          />
          <MoreTile
            icon={LifeBuoy}
            label={t("more.help")}
            sub={t("more.helpSub")}
            onClick={() => openHelp()}
          />
        </div>
      </section>

      {/* App language — community-translated via the admin panel */}
      <section aria-label="App language">
        <h2 className="mb-3 font-semibold tracking-tight">{t("more.language")}</h2>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("more.language")}>
            {LANGS.map((l) => (
              <button
                key={l.key}
                type="button"
                aria-pressed={lang === l.key}
                onClick={() => setLang(l.key)}
                className={cn(
                  "min-h-10 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  lang === l.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">{t("more.languageSub")}</p>
        </div>
      </section>

      {/* Wishlist (device) */}
      <section aria-label="Wishlist" id="more-saved">
        <h2 className="mb-3 font-semibold tracking-tight">{t("more.wishlist")}</h2>
        {savedIds.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Nothing saved yet"
            description="Tap the heart on any home and it waits for you here — stored right on your device."
          />
        ) : snips === null ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {savedIds.map((id) => {
              const snip = snips[id];
              if (snip === undefined) return null;
              if (snip === "GONE") {
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-dashed bg-card p-3"
                  >
                    <span className="text-sm text-muted-foreground">
                      A saved home is no longer available.
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleSavedLocal(id, false)}
                      className="h-8 shrink-0 rounded-full text-muted-foreground"
                    >
                      <Trash2 className="size-3.5" aria-hidden /> Remove
                    </Button>
                  </li>
                );
              }
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => openProperty(id)}
                    className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {snip.photos?.[0] ? (
                      <Photo
                        src={snip.photos[0]}
                        alt=""
                        className="size-14 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <House className="size-5 text-primary" aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{snip.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {snip.block} · {formatRent(snip.rent)}/mo
                        {snip.status !== "ACTIVE" ? " · no longer available" : ""}
                      </span>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${snip.title} from saved`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSavedLocal(id, false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSavedLocal(id, false);
                        }
                      }}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Contact history (device) */}
      <section aria-label="Contact history">
        <h2 className="mb-3 font-semibold tracking-tight">{t("more.history")}</h2>
        <ContactHistory />
      </section>

      {/* Staff entry — deliberately quiet */}
      <div className="flex items-center justify-center gap-2 pb-2 text-xs text-muted-foreground">
        <span>iShim agent or admin?</span>
        <button
          type="button"
          onClick={() => openAuth()}
          className="inline-flex items-center gap-1 rounded-full font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ShieldCheck className="size-3.5 text-primary" aria-hidden />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

export function ProfileView() {
  const user = useStore((s) => s.user);

  if (!user) return <GuestCard />;

  return (
    <div className="space-y-6">
      <DashboardHeader />
      {user.role === "CLIENT" ? <ClientDashboard /> : null}
      {user.role === "OWNER" ? <OwnerDashboard /> : null}
      {user.role === "AGENT" ? <AgentDashboard /> : null}
      {user.role === "ADMIN" ? <AdminDashboard /> : null}
    </div>
  );
}
