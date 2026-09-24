"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Ban,
  Banknote,
  Building2,
  CalendarCheck,
  Check,
  Download,
  Eye,
  FileText,
  Home,
  Image as ImageIcon,
  IndianRupee,
  KeyRound,
  LayoutDashboard,
  Loader2,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Phone,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Star,
  Store,
  Trash2,
  TriangleAlert,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Photo } from "./photo";
import { PanelTabGrid, type PanelTab } from "./panel-tab-grid";
import { EmptyState } from "./empty-state";
import { StatusBadge } from "./status-badge";
import { AdminIntakeList } from "./admin-intake-list";
import { AreaRequestsCard } from "./area-requests-card";
import { WardManager } from "./ward-manager";
import { AdsTab } from "./admin-ads-tab";
import { ContentTab } from "./admin-content-tab";
import { AdminInsightsTab } from "./insights";
import { VerticalSwitch } from "./vertical-switch";
import { useStore } from "@/lib/store";
import { adminApi, enquiryApi } from "@/lib/api";
import { impersonateUser } from "@/lib/impersonate";
import { toastError, toastSuccess } from "@/lib/feedback";
import { CORE_KEYS, CORE_STRINGS, coverage, type LangOverrides } from "@/lib/i18n";
import { ENQUIRY_DEFAULT_KEY, ENQUIRY_TEMPLATES, renderTemplates } from "@/lib/wa-templates";
import { WaTemplateDialog } from "./wa-template-dialog";
import {
  ENQUIRY_STATUS_LABELS,
  ROLE_LABELS,
  formatDate,
  formatRent,
  typeLabel,
  type AdminEnquiry,
  type AdminStats,
  type AdminUser,
  type ListingMode,
  type Payment,
  type Property,
  type PropertyStatus,
  type Role,
  type EnquiryStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["CLIENT", "OWNER", "AGENT", "ADMIN"];
const STATUSES: PropertyStatus[] = ["PENDING", "ACTIVE", "RENTED", "HIDDEN", "REJECTED"];

const PANEL_TABS: PanelTab[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "leads", label: "Inbox", icon: MessagesSquare },
  { key: "users", label: "People", icon: Users },
  { key: "properties", label: "Listings", icon: Building2 },
  { key: "financials", label: "Payments", icon: IndianRupee },
  { key: "areas", label: "Areas", icon: MapPin },
  { key: "content", label: "Content", icon: FileText },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

// ─── Overview ────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Home;
  label: string;
  value: number | string;
  tone?: "default" | "amber";
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-full",
            tone === "amber" ? "bg-amber-100" : "bg-primary/10"
          )}
        >
          <Icon className={cn("size-4.5", tone === "amber" ? "text-amber-700" : "text-primary")} aria-hidden />
        </span>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function OverviewTab({ mode }: { mode: ListingMode }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const business = mode === "BUSINESS";

  const load = useCallback(() => {
    adminApi
      .getStats(mode)
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load stats"));
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <EmptyState icon={TriangleAlert} title="Couldn't load stats" description={error} actionLabel="Retry" onAction={load} />;
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={Users} label="Users (all verticals)" value={stats.users.total} />
        <StatTile
          icon={business ? Store : Home}
          label={business ? "Business spaces" : "Homes"}
          value={stats.properties.total}
        />
        <StatTile icon={Banknote} label="Revenue" value={formatRent(stats.revenueTotal)} />
        <StatTile
          icon={TriangleAlert}
          label="Success fees due"
          value={stats.feeDueCount}
          tone={stats.feeDueCount > 0 ? "amber" : "default"}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium">Users by role</p>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <Badge key={r} variant="secondary" className="rounded-full px-3 font-normal">
                {ROLE_LABELS[r]}: <span className="font-semibold">{stats.users.byRole[r]}</span>
              </Badge>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium">Properties by status</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Badge key={s} variant="secondary" className="rounded-full px-3 font-normal">
                {s.toLowerCase()}: <span className="font-semibold">{stats.properties.byStatus[s]}</span>
              </Badge>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total WhatsApp clicks</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{stats.whatsappClicks}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Payments recorded</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{stats.paymentsCount}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Approvals queue ─────────────────────────────────────────────

function ApprovalsTab({ mode }: { mode: ListingMode }) {
  const bumpListings = useStore((s) => s.bumpListings);
  const [queue, setQueue] = useState<Property[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Property | null>(null);
  const business = mode === "BUSINESS";

  const load = useCallback(() => {
    setError(null);
    adminApi
      .getProperties("PENDING", mode, 0, 100)
      .then((d) => setQueue(d.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load queue"));
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (p: Property) => {
    setBusyId(p.id);
    try {
      await adminApi.patchProperty(p.id, { status: "ACTIVE" });
      toastSuccess("Listing approved", `${p.title} is now live.`);
      bumpListings();
      load();
    } catch (e) {
      toastError(e, "Could not approve");
    } finally {
      setBusyId(null);
    }
  };

  if (error) {
    return <EmptyState icon={TriangleAlert} title="Couldn't load the queue" description={error} actionLabel="Retry" onAction={load} />;
  }

  if (queue === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  if (!queue.length) {
    return (
      <EmptyState
        icon={business ? Store : ShieldCheck}
        title={business ? "No business listings waiting" : "Queue is clear"}
        description={
          business
            ? "Every business listing has been reviewed. New shop, office and cafe submissions will appear here."
            : "Every listing has been reviewed. New submissions from owners and agents will appear here."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {queue.length} {business ? "business listing" : "home"}
        {queue.length === 1 ? "" : "s"} waiting for review — check photos, price and block before approving.
      </p>
      <ul className="space-y-3">
        {queue.map((p) => (
          <li key={p.id} className="rounded-2xl border bg-card p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex gap-2 sm:w-56">
                {(p.photos ?? []).slice(0, 3).map((src) => (
                  <Photo key={src} src={src} alt={p.title} className="h-20 flex-1 rounded-xl" />
                ))}
                {!p.photos?.length ? (
                  <Photo src={undefined} alt={p.title} className="h-20 w-full rounded-xl" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {p.block} · {typeLabel(p)} · {formatRent(p.rent)}/mo ·{" "}
                  Deposit {formatRent(p.deposit)}
                  {p.mode === "BUSINESS"
                    ? p.areaSqft
                      ? ` · ${p.areaSqft.toLocaleString("en-IN")} sq ft`
                      : ""
                    : ` · ${p.bedrooms} bed / ${p.bathrooms} bath`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Owner: {p.owner?.name ?? "Unknown"} ({p.owner?.phone ?? "—"})
                  {p.owner?.verified ? " · verified" : " · not verified"}
                </p>
                {p.description ? <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p> : null}
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-col sm:justify-center">
                <Button
                  size="sm"
                  onClick={() => void approve(p)}
                  disabled={busyId === p.id}
                  className="min-h-10 rounded-full"
                >
                  {busyId === p.id ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejecting(p)}
                  disabled={busyId === p.id}
                  className="min-h-10 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <X aria-hidden /> Reject
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <RejectDialog
        property={rejecting}
        onClose={() => setRejecting(null)}
        onRejected={() => {
          setRejecting(null);
          bumpListings();
          load();
        }}
      />
    </div>
  );
}

function RejectDialog({
  property,
  onClose,
  onRejected,
}: {
  property: Property | null;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (property) setReason("");
  }, [property]);

  const submit = async () => {
    if (!property) return;
    setBusy(true);
    try {
      await adminApi.patchProperty(property.id, {
        status: "REJECTED",
        rejectionReason: reason.trim() || "Photos or details need improvement — please re-list with clear daytime photos.",
      });
      toastSuccess("Listing rejected", "The owner will see your note.");
      onRejected();
    } catch (e) {
      toastError(e, "Could not reject listing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!property} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Reject listing</DialogTitle>
          <DialogDescription>
            {property?.title} — add a polite, helpful reason. The owner sees it on their dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rej-reason">Reason</Label>
          <Input
            id="rej-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Photos are too dark — please upload daytime photos"
            className="h-11 rounded-xl"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              "Photos are dark/blurry — please upload daytime photos",
              "Rent seems off for this block — please review",
              "More photos of rooms needed",
            ].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setReason(s)}
                className="rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} variant="destructive" className="rounded-full px-6">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Reject listing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Users ───────────────────────────────────────────────────────

function UsersTab() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Add-staff dialog (Google-email sign-up for agents & admin)
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", role: "AGENT" as "AGENT" | "ADMIN" });
  const [addBusy, setAddBusy] = useState(false);

  const load = useCallback((query: string) => {
    setError(null);
    adminApi
      .getUsers(query || undefined)
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load users"));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => load(q), 250);
    return () => window.clearTimeout(t);
  }, [q, load]);

  const patch = async (u: AdminUser, payload: Parameters<typeof adminApi.patchUser>[1]) => {
    setBusyId(u.id);
    try {
      const updated = await adminApi.patchUser(u.id, payload);
      setUsers((list) => (list ? list.map((x) => (x.id === u.id ? { ...x, ...updated } : x)) : list));
      toastSuccess("User updated", `${u.name} saved.`);
      return true;
    } catch (e) {
      toastError(e, "Could not update user");
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const impersonate = async (u: AdminUser) => {
    setBusyId(u.id);
    await impersonateUser(u.id, u.name);
    setBusyId(null);
  };

  /** Create a staff account the person can later Google-sign-in with. */
  const addStaff = async () => {
    setAddBusy(true);
    try {
      const created = await adminApi.addStaff({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        role: form.role,
      });
      setUsers((list) => (list ? [created, ...list] : list));
      setAddOpen(false);
      setForm({ name: "", phone: "", email: "", role: "AGENT" });
      toastSuccess(
        `${created.name} added as ${created.role.toLowerCase()}`,
        "They sign in with Google using this email — no password needed."
      );
    } catch (e) {
      toastError(e, "Could not add the staff member");
    } finally {
      setAddBusy(false);
    }
  };

  if (error) {
    return <EmptyState icon={TriangleAlert} title="Couldn't load users" description={error} actionLabel="Retry" onAction={() => load(q)} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or phone…"
            aria-label="Search people"
            className="h-11 rounded-full pl-10"
          />
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="h-11 shrink-0 rounded-full pl-3 pr-4"
          aria-label="Add an agent or admin"
        >
          <UserPlus aria-hidden />
          Add staff
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Locals never need accounts — only iShim agents &amp; admin sign in
        (with Google). Added someone? Just tell them to tap
        "Continue with Google".
      </p>

      {users === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="No users found" description={`Nobody matches "${q}".`} />
      ) : (
        <ul className="max-h-[32rem] space-y-2 overflow-y-auto thin-scrollbar pr-1">
          {users.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                  {u.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {u.name}
                    {u.verified ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" /> : null}
                    {u.banned ? (
                      <Badge className="rounded-full bg-destructive/10 text-destructive border border-destructive/20">Banned</Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ROLE_LABELS[u.role]} · {u.phone}
                    {u.email ? ` · ${u.email}` : ""} · {u.propertiesCount ?? 0} listings · {u.contactsCount ?? 0} enquiries
                  </p>
                </div>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                <Select
                  value={u.role}
                  onValueChange={(v) => void patch(u, { role: v as Role })}
                >
                  <SelectTrigger
                    aria-label={`Role for ${u.name}`}
                    className="col-span-2 h-10 w-full rounded-full text-xs sm:col-span-1 sm:w-[7.5rem]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant={u.verified ? "secondary" : "outline"}
                  disabled={busyId === u.id}
                  onClick={() => void patch(u, { verified: !u.verified })}
                  className="min-h-10 rounded-full"
                >
                  <BadgeCheck aria-hidden />
                  {u.verified ? "Unverify" : "Verify"}
                </Button>
                <Button
                  size="sm"
                  variant={u.banned ? "secondary" : "outline"}
                  disabled={busyId === u.id}
                  onClick={() => void patch(u, { banned: !u.banned })}
                  className={cn(
                    "min-h-10 rounded-full",
                    !u.banned && "text-destructive hover:bg-destructive/10 hover:text-destructive"
                  )}
                >
                  <Ban aria-hidden />
                  {u.banned ? "Unban" : "Ban"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === u.id || u.role === "ADMIN"}
                  onClick={() => void impersonate(u)}
                  className="min-h-10 rounded-full text-muted-foreground"
                >
                  <Eye aria-hidden /> Impersonate
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add staff — Google-email sign-up for agents & admin */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl thin-scrollbar sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Add a staff member</DialogTitle>
            <DialogDescription>
              Agents &amp; admin sign in with Google only. Add their Google
              email here and tell them to tap &quot;Continue with Google&quot; —
              their account connects automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="staff-name">Full name</Label>
              <Input
                id="staff-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Marcus Chonsinrao"
                className="h-11 rounded-xl"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-phone">Contact phone (WhatsApp)</Label>
              <Input
                id="staff-phone"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. 9856001103"
                className="h-11 rounded-xl"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-email">Google email they sign in with</Label>
              <Input
                id="staff-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="e.g. marcus@gmail.com"
                className="h-11 rounded-xl"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as "AGENT" | "ADMIN" }))}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AGENT">Agent — handles listings &amp; clients</SelectItem>
                  <SelectItem value="ADMIN">Admin — full control centre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => void addStaff()}
              disabled={addBusy || !form.name.trim() || !form.phone.trim() || !form.email.trim()}
              className="h-11 w-full rounded-full text-base"
            >
              {addBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
              Add staff member
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Leads (every enquiry on the platform) ──────────────────────

const ENQUIRY_STATUSES: EnquiryStatus[] = ["NEW", "CONTACTED", "SCHEDULED", "CLOSED"];

function enquiryStatusClass(s: EnquiryStatus): string {
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

function formatVisitSlot(iso: string | null): string {
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

function LeadsTab() {
  const [source, setSource] = useState<"enquiries" | "intake">("enquiries");
  const [status, setStatus] = useState<string>("ALL");
  const [kind, setKind] = useState<string>("ALL");
  const [modeFilter, setModeFilter] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminEnquiry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [waEnq, setWaEnq] = useState<AdminEnquiry | null>(null);
  const staffName = useStore((s) => s.user)?.name ?? "iShim";

  const filters = useCallback(
    (skip: number) => ({
      status: status === "ALL" ? undefined : status,
      kind: kind === "ALL" ? undefined : kind,
      mode: modeFilter === "ALL" ? undefined : (modeFilter as "HOME" | "BUSINESS"),
      q: q.trim() || undefined,
      skip,
    }),
    [status, kind, modeFilter, q]
  );

  const load = useCallback(() => {
    setError(null);
    const f = filters(0);
    adminApi
      .getEnquiries(f.status, f.kind, f.mode, f.q)
      .then((d) => {
        setRows(d.items);
        setTotal(d.total);
        setHasMore(d.hasMore);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load leads"));
  }, [filters]);

  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  const loadMore = () => {
    if (loadingMore || !hasMore || rows === null) return;
    setLoadingMore(true);
    const f = filters(rows.length);
    adminApi
      .getEnquiries(f.status, f.kind, f.mode, f.q, f.skip)
      .then((d) => {
        setRows((prev) => {
          const seen = new Set((prev ?? []).map((r) => r.id));
          return [...(prev ?? []), ...d.items.filter((r) => !seen.has(r.id))];
        });
        setTotal(d.total);
        setHasMore(d.hasMore);
      })
      .catch((e) => toastError(e, "Could not load more leads"))
      .finally(() => setLoadingMore(false));
  };

  const setStatusOn = async (id: string, next: EnquiryStatus) => {
    setBusyId(id);
    const prev = rows;
    setRows((list) => list?.map((r) => (r.id === id ? { ...r, status: next } : r)) ?? null);
    try {
      await enquiryApi.update(id, { status: next });
      toastSuccess("Lead updated", `Marked ${ENQUIRY_STATUS_LABELS[next]}.`);
    } catch (e) {
      setRows(prev ?? null);
      toastError(e, "Could not update the lead");
    } finally {
      setBusyId(null);
    }
  };

  if (error) {
    return <EmptyState icon={TriangleAlert} title="Couldn't load leads" description={error} actionLabel="Retry" onAction={load} />;
  }

  const chip = (active: boolean) =>
    cn(
      "min-h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
    );

  return (
    <div className="space-y-3">
      {/* Source toggle: enquiry leads vs no-account listing requests */}
      <div className="flex gap-1.5" role="group" aria-label="Lead source">
        <button
          type="button"
          aria-pressed={source === "enquiries"}
          onClick={() => setSource("enquiries")}
          className={cn(
            "min-h-9 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            source === "enquiries" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          Enquiries & messages
        </button>
        <button
          type="button"
          aria-pressed={source === "intake"}
          onClick={() => setSource("intake")}
          className={cn(
            "min-h-9 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            source === "intake" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          Listing requests
        </button>
      </div>

      {source === "intake" ? (
        <AdminIntakeList />
      ) : (
      <>
      {/* Filters — horizontal scroll rows on mobile */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, listing…"
            aria-label="Search leads"
            className="h-11 rounded-full pl-10"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 thin-scrollbar">
          {["ALL", "HOME", "BUSINESS"].map((m) => (
            <button key={m} type="button" aria-pressed={modeFilter === m} onClick={() => setModeFilter(m)} className={chip(modeFilter === m)}>
              {m === "ALL" ? "All verticals" : m === "HOME" ? "Homes" : "Business"}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 thin-scrollbar">
          {["ALL", ...ENQUIRY_STATUSES].map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={chip(status === s)}>
              {s === "ALL" ? "Any status" : ENQUIRY_STATUS_LABELS[s as EnquiryStatus]}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 thin-scrollbar">
          {["ALL", "VISIT", "GENERAL"].map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
              {k === "ALL" ? "Enquiries & visits" : k === "VISIT" ? "Visit bookings" : "Messages"}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No leads match"
          description="No enquiries or visit bookings match these filters yet."
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {rows.length} of {total} lead{total === 1 ? "" : "s"} — every client message, visit booking and
            contact click across the platform.
          </p>
          <ul className="space-y-2.5">
            {rows.map((e) => (
              <li key={e.id}>
                <article
                  className="rounded-2xl border bg-card p-4 shadow-sm"
                  aria-label={`Lead from ${e.name} about ${e.property.title}`}
                >
                  <div className="flex gap-3">
                    <Photo
                      src={e.property.photos?.[0] ?? null}
                      alt={e.property.title}
                      className="h-16 w-16 shrink-0 rounded-xl sm:h-20 sm:w-20"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className={cn("rounded-full", enquiryStatusClass(e.status))}>
                          {ENQUIRY_STATUS_LABELS[e.status]}
                        </Badge>
                        {e.kind === "VISIT" ? (
                          <Badge variant="outline" className="gap-1 rounded-full">
                            <CalendarCheck className="size-3" aria-hidden />
                            Visit · {formatVisitSlot(e.visitAt)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full">
                            Message
                          </Badge>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">{formatDate(e.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 truncate text-sm font-medium">{e.property.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.property.block} · {formatRent(e.property.rent)}/mo ·{" "}
                        {e.property.mode === "BUSINESS" ? "Business" : "Homes"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-1.5 rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
                    <p className="flex flex-wrap items-center gap-1">
                      <span className="font-medium">{e.name}</span>
                      {e.requester ? (
                        <Badge variant="secondary" className="rounded-full px-2 text-[10px] font-normal">
                          {ROLE_LABELS[e.requester.role]} on iShim
                        </Badge>
                      ) : null}
                      <span className="text-muted-foreground"> · {e.phone}</span>
                    </p>
                    {e.message ? (
                      <p className="text-sm leading-relaxed text-foreground/80">“{e.message}”</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Contact reveal — no message attached.</p>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Handled by{" "}
                    <span className="font-medium text-foreground/80">
                      {e.handler
                        ? `${e.handler.name} (${ROLE_LABELS[e.handler.role]})`
                        : e.property.owner
                          ? `${e.property.owner.name} (Owner)`
                          : "—"}
                    </span>
                    {e.property.handledByAgent ? " · agent-listed" : ""}
                  </p>

                  <div className="mt-3 grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                    <Button asChild variant="outline" size="sm" className="min-h-10 rounded-full">
                      <a href={`tel:${e.phone}`}>
                        <Phone aria-hidden /> Call
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-10 rounded-full"
                      onClick={() => setWaEnq(e)}
                    >
                      <MessageCircle aria-hidden /> WhatsApp
                    </Button>
                    <Select
                      value={e.status}
                      onValueChange={(v) => void setStatusOn(e.id, v as EnquiryStatus)}
                      disabled={busyId === e.id}
                    >
                      <SelectTrigger aria-label={`Status for lead from ${e.name}`} className="col-span-2 h-10 w-full rounded-full text-xs sm:col-span-1 sm:ml-auto sm:w-[10.5rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ENQUIRY_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {ENQUIRY_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </article>
              </li>
            ))}
          </ul>
          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={loadMore}
                className="min-h-11 rounded-full px-6"
              >
                {loadingMore ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Load more leads
              </Button>
            </div>
          ) : null}
        </>
      )}
      </>
      )}

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
            agentName: staffName,
            kind: waEnq.kind === "VISIT" ? "VISIT" : "GENERAL",
          })}
          defaultKey={ENQUIRY_DEFAULT_KEY[waEnq.kind]}
        />
      ) : null}
    </div>
  );
}

// ─── Properties ──────────────────────────────────────────────────

function PropertiesTab({ mode }: { mode: ListingMode }) {
  const bumpListings = useStore((s) => s.bumpListings);
  const [status, setStatus] = useState<string>("ALL");
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    (s: string) => {
      setError(null);
      adminApi
        .getProperties(s === "ALL" ? undefined : s, mode)
        .then((d) => {
          setProperties(d.items);
          setTotal(d.total);
          setHasMore(d.hasMore);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load properties"));
    },
    [mode]
  );

  useEffect(() => {
    load(status);
  }, [status, load]);

  const patch = async (p: Property, payload: Parameters<typeof adminApi.patchProperty>[1]) => {
    setBusyId(p.id);
    try {
      await adminApi.patchProperty(p.id, payload);
      toastSuccess("Property updated", p.title);
      bumpListings();
      load(status);
    } catch (e) {
      toastError(e, "Could not update property");
    } finally {
      setBusyId(null);
    }
  };

  /** Append the next page of admin listings under the current filter. */
  const loadMore = () => {
    if (loadingMore || !hasMore || properties === null) return;
    setLoadingMore(true);
    adminApi
      .getProperties(status === "ALL" ? undefined : status, mode, properties.length)
      .then((d) => {
        setProperties((prev) => {
          const seen = new Set((prev ?? []).map((p) => p.id));
          return [...(prev ?? []), ...d.items.filter((p) => !seen.has(p.id))];
        });
        setTotal(d.total);
        setHasMore(d.hasMore);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load more"))
      .finally(() => setLoadingMore(false));
  };

  if (error) {
    return <EmptyState icon={TriangleAlert} title="Couldn't load properties" description={error} actionLabel="Retry" onAction={() => load(status)} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {["ALL", ...STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={cn(
              "min-h-9 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {properties === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <EmptyState icon={Home} title="No properties here" description="Try a different status filter." />
      ) : (
        <ul className="max-h-[32rem] space-y-2 overflow-y-auto thin-scrollbar pr-1">
          {properties.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center">
              <Photo src={p.photos?.[0]} alt={p.title} className="h-20 w-full shrink-0 rounded-xl lg:w-28" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{p.title}</p>
                  <StatusBadge status={p.status} />
                  {p.featured ? (
                    <Badge className="rounded-full border border-primary/20 bg-primary/10 text-primary">
                      <Star className="size-3 fill-current" aria-hidden /> Featured
                    </Badge>
                  ) : null}
                  {p.feeWaived ? (
                    <Badge variant="outline" className="rounded-full border-primary/30 text-primary">
                      Fee waived
                    </Badge>
                  ) : null}
                  {p.rentedAt && !p.feePaid && !p.feeWaived ? (
                    <Badge className="rounded-full bg-amber-100 text-amber-800 border border-amber-200">Fee due</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {p.block} · {typeLabel(p)} · {formatRent(p.rent)}/mo · Owner {p.owner?.name ?? "—"} ({p.owner?.phone ?? "—"})
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                <Select value={p.status ?? "ACTIVE"} onValueChange={(v) => void patch(p, { status: v })}>
                  <SelectTrigger aria-label={`Status for ${p.title}`} className="col-span-2 h-10 w-full rounded-full text-xs sm:col-span-1 sm:w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant={p.featured ? "secondary" : "outline"}
                  aria-label={p.featured ? `Unfeature ${p.title}` : `Feature ${p.title}`}
                  disabled={busyId === p.id}
                  onClick={() => void patch(p, { featured: !p.featured })}
                  className="size-10 rounded-full"
                >
                  <Star className={cn("size-4", p.featured && "fill-primary text-primary")} aria-hidden />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === p.id || p.feeWaived}
                  onClick={() => void patch(p, { feeWaived: true })}
                  className="min-h-10 rounded-full"
                >
                  <IndianRupee aria-hidden /> Waive fee
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination footer */}
      {properties !== null && properties.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {properties.length} of {total}
          </p>
          {hasMore ? (
            <Button
              size="sm"
              variant="outline"
              disabled={loadingMore}
              onClick={loadMore}
              className="min-h-9 rounded-full"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
                </>
              ) : (
                "Load more"
              )}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── Financials ──────────────────────────────────────────────────

function FinancialsTab({ mode }: { mode: ListingMode }) {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi
      .getPayments(mode)
      .then((data) => {
        setPayments(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load payments"));
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <EmptyState icon={TriangleAlert} title="Couldn't load payments" description={error} actionLabel="Retry" onAction={load} />;
  }

  if (payments === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </div>
    );
  }

  const total = payments.reduce((a, p) => a + p.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-secondary px-4 py-3">
        <span className="text-sm font-medium text-secondary-foreground">
          Revenue — {mode === "BUSINESS" ? "Business spaces" : "Homes"}
        </span>
        <span className="text-xl font-semibold text-secondary-foreground">{formatRent(total)}</span>
      </div>
      {payments.length === 0 ? (
        <EmptyState icon={Banknote} title="No payments yet" description="Success fees appear here the moment an owner pays." />
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto thin-scrollbar pr-1">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.property?.title ?? "Property"}</p>
                <p className="text-xs text-muted-foreground">
                  {p.payer?.name ?? "Owner"} · {p.method}
                  {p.kind === "WAIVED" ? " · waived" : ""} · {formatDate(p.createdAt)}
                </p>
              </div>
              <span className={cn("shrink-0 font-semibold", p.kind === "WAIVED" ? "text-muted-foreground" : "text-primary")}>
                {p.amount === 0 ? "₹0" : formatRent(p.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────

function ChipEditor({
  label,
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  const add = () => {
    const v = value.trim();
    if (!v) return;
    if (items.includes(v)) {
      setValue("");
      return;
    }
    onAdd(v);
    setValue("");
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="flex items-center gap-1 rounded-full bg-secondary py-1.5 pl-3 pr-1.5 text-sm text-secondary-foreground"
          >
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => onRemove(item)}
              className="flex size-6 items-center justify-center rounded-full transition-colors hover:bg-background"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-10 rounded-xl"
        />
        <Button type="button" variant="secondary" onClick={add} className="h-10 shrink-0 rounded-xl">
          <Plus aria-hidden /> Add
        </Button>
      </div>
    </div>
  );
}

function SettingsTab() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [fee, setFee] = useState("499");
  const [freeStart, setFreeStart] = useState("");
  const [freeMonths, setFreeMonths] = useState("36");
  const [agentHelp, setAgentHelp] = useState("0");
  const [webListing, setWebListing] = useState("0");
  const [commission, setCommission] = useState("0");
  const [postNote, setPostNote] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [houseTypes, setHouseTypes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [langMap, setLangMap] = useState<LangOverrides>({});
  const [langQ, setLangQ] = useState("");

  useEffect(() => {
    if (settings) {
      setFee(String(settings.successFee));
      setFreeStart(settings.freeModelStartAt?.slice(0, 10) ?? "");
      setFreeMonths(String(settings.freeModelMonths));
      setAgentHelp(String(settings.agentHelpFee));
      setWebListing(String(settings.webListingCharge));
      setCommission(String(settings.commissionFee));
      setPostNote(settings.postTrialNote ?? "");
      setAmenities(settings.amenities);
      setHouseTypes(settings.houseTypes);
      setLangMap(settings.langOverrides ?? {});
    }
  }, [settings]);

  // Live preview of the window the admin is editing (before saving).
  const previewEnd = (() => {
    if (!freeStart) return null;
    const start = new Date(`${freeStart}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) return null;
    start.setUTCMonth(start.getUTCMonth() + Math.max(1, Number(freeMonths) || 36));
    return start;
  })();
  const previewDays = previewEnd
    ? Math.max(0, Math.ceil((previewEnd.getTime() - Date.now()) / 86_400_000))
    : 0;

  const save = async (payload: {
    successFee?: number;
    bizSuccessFee?: number;
    freeModelStartAt?: string;
    freeModelMonths?: number;
    agentHelpFee?: number;
    bizAgentHelpFee?: number;
    webListingCharge?: number;
    commissionFee?: number;
    postTrialNote?: string;
    blocks?: string[];
    amenities?: string[];
    houseTypes?: string[];
    langOverrides?: LangOverrides;
  }) => {
    setBusy(true);
    try {
      const updated = await adminApi.patchSettings(payload);
      setSettings(updated);
      toastSuccess("Settings saved", "Changes apply across the platform instantly.");
    } catch (e) {
      toastError(e, "Could not save settings");
    } finally {
      setBusy(false);
    }
  };

  /** Flat pricing model: one trial fee (both verticals) + post-trial TBA amounts. */
  const savePricing = async () => {
    const startIso = freeStart
      ? new Date(`${freeStart}T00:00:00.000Z`).toISOString()
      : undefined;
    const flatFee = Math.max(0, Number(fee) || 0);
    const help = Math.max(0, Number(agentHelp) || 0);
    await save({
      successFee: flatFee,
      bizSuccessFee: flatFee, // kept flat — homes & business alike
      ...(startIso ? { freeModelStartAt: startIso } : {}),
      freeModelMonths: Math.max(1, Number(freeMonths) || 36),
      agentHelpFee: help,
      bizAgentHelpFee: help,
      webListingCharge: Math.max(0, Number(webListing) || 0),
      commissionFee: Math.max(0, Number(commission) || 0),
      postTrialNote: postNote.trim().slice(0, 500),
    });
  };

  if (!settings) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  /** Excel backup of every listing, person, lead, enquiry, payment and setting. */
  const downloadBackup = async () => {
    setBackupBusy(true);
    try {
      const c = await adminApi.downloadBackup();
      toastSuccess(
        "Backup downloaded",
        `${c.listings} listings · ${c.people} people · ${c.leads} leads · ${c.enquiries} enquiries · ${c.payments} payments`,
      );
    } catch (e) {
      toastError(e, "Could not download the backup");
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Free window — shared platform-wide</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Everything is free during the window; only the move-in fee is
              charged. Each vertical keeps its own fees in its panel below.
            </p>
          </div>
          {previewEnd ? (
            <span
              className={
                previewDays > 0
                  ? "rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-primary"
                  : "rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
              }
            >
              {previewDays > 0
                ? `Free · ${previewDays.toLocaleString("en-IN")} days left`
                : "Standard pricing"}
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="set-free-start" className="text-sm font-medium">
              Free period starts on
            </Label>
            <Input
              id="set-free-start"
              type="date"
              value={freeStart}
              onChange={(e) => setFreeStart(e.target.value)}
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Starting date of the 36-month free window — set by admin.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-free-months" className="text-sm font-medium">
              Free period length (months)
            </Label>
            <Input
              id="set-free-months"
              type="number"
              min={1}
              max={240}
              inputMode="numeric"
              value={freeMonths}
              onChange={(e) => setFreeMonths(e.target.value)}
              className="h-11 max-w-40 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">Default 36 months.</p>
          </div>
        </div>
      </div>

      {/* Flat trial fee — homes & business alike */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="size-4 text-primary" aria-hidden />
            Flat move-in success fee — during the free trial
          </p>
          <Badge className="rounded-full bg-secondary text-[11px] font-medium text-primary">
            Homes &amp; business · one price
          </Badge>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="set-fee" className="text-sm font-medium">
              Success fee when a rental closes (₹)
            </Label>
            <Input
              id="set-fee"
              type="number"
              min={0}
              inputMode="numeric"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="h-11 max-w-40 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              The one-time flat fee — no client/owner split, charged only when
              a home or space is actually rented (default ₹499).
            </p>
          </div>
        </div>
      </div>

      {/* After the free trial — amounts the admin adds when decided */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <p className="text-sm font-semibold">After the free trial — add the amounts when decided</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Leave 0 to show “To be announced” on the pricing page. The details
          note appears under the cards.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="set-web-listing" className="text-sm font-medium">
              Web listing charge (₹)
            </Label>
            <Input
              id="set-web-listing"
              type="number"
              min={0}
              inputMode="numeric"
              value={webListing}
              onChange={(e) => setWebListing(e.target.value)}
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">Per listing on iShim.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-agent-help" className="text-sm font-medium">
              Agent help (₹)
            </Label>
            <Input
              id="set-agent-help"
              type="number"
              min={0}
              inputMode="numeric"
              value={agentHelp}
              onChange={(e) => setAgentHelp(e.target.value)}
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Full-service listing &amp; upkeep by an agent.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-commission" className="text-sm font-medium">
              Commission (₹)
            </Label>
            <Input
              id="set-commission"
              type="number"
              min={0}
              inputMode="numeric"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">On a successful rental.</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="set-post-note" className="text-sm font-medium">
            Details shown on the pricing page
          </Label>
          <Textarea
            id="set-post-note"
            value={postNote}
            onChange={(e) => setPostNote(e.target.value)}
            placeholder="e.g. Announced before the trial ends — listing ₹249, agent help ₹499, commission one month's rent."
            className="min-h-20 rounded-xl"
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        {previewEnd ? (
          <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Preview: free until{" "}
            {previewEnd.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {" "}
            ({previewDays.toLocaleString("en-IN")} days left) — flat ₹
            {Math.max(0, Number(fee) || 0)} success fee when rented; then web
            listing ₹{Math.max(0, Number(webListing) || 0)}, agent help ₹
            {Math.max(0, Number(agentHelp) || 0)}, commission ₹
            {Math.max(0, Number(commission) || 0)} (0 = “to be announced”).
          </p>
        ) : null}

        <Button
          onClick={() => void savePricing()}
          disabled={busy || !freeStart}
          className="mt-4 rounded-full px-6"
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Save pricing
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          One save applies to the whole platform — homes and business.
        </p>
      </div>

      {/* "My area is not listed" requests + the ward list & photos live in the dedicated Areas tab */}

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <ChipEditor
          label="Amenities"
          items={amenities}
          placeholder="e.g. Solar Heating"
          onAdd={(v) => setAmenities((a) => [...a, v])}
          onRemove={(v) => setAmenities((a) => a.filter((x) => x !== v))}
        />
        <Button onClick={() => void save({ amenities })} disabled={busy} className="mt-3 rounded-full" size="sm">
          Save amenities
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <ChipEditor
          label="House types (ASSAM_TYPE, RCC, KUTCHA, APARTMENT)"
          items={houseTypes}
          placeholder="e.g. APARTMENT"
          onAdd={(v) => setHouseTypes((t) => [...t, v.toUpperCase().replace(/\s+/g, "_")])}
          onRemove={(v) => setHouseTypes((t) => t.filter((x) => x !== v))}
        />
        <Button onClick={() => void save({ houseTypes })} disabled={busy} className="mt-3 rounded-full" size="sm">
          Save house types
        </Button>
      </div>

      {/* Data backup — one Excel workbook with everything */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Data backup</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Download everything as one Excel workbook — listings, people,
              leads, enquiries, payments and settings. Handy for records or
              sharing with the team.
            </p>
          </div>
        </div>
        <Button
          onClick={() => void downloadBackup()}
          disabled={backupBusy}
          className="mt-4 rounded-full px-6"
        >
          {backupBusy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          Download Excel backup
        </Button>
      </div>

      {/* App language — community-translated strings for Tangkhul / Meiteilon */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">App language — Tangkhul &amp; Meiteilon</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fill in translations for the core app strings — guests pick the
              language in their More tab. Anything left empty stays English.
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Badge className="rounded-full bg-secondary text-[11px] font-medium text-primary">
              Tangkhul {coverage("TK", langMap)}/{CORE_KEYS.length}
            </Badge>
            <Badge className="rounded-full bg-secondary text-[11px] font-medium text-primary">
              Meiteilon {coverage("MN", langMap)}/{CORE_KEYS.length}
            </Badge>
          </div>
        </div>

        <Input
          value={langQ}
          onChange={(e) => setLangQ(e.target.value)}
          placeholder="Search a string…"
          aria-label="Search strings to translate"
          className="mt-3 h-10 rounded-full"
        />

        <div className="thin-scrollbar mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
          {CORE_KEYS.filter((k) => {
            const en = CORE_STRINGS[k];
            const q = langQ.trim().toLowerCase();
            return !q || k.toLowerCase().includes(q) || en.toLowerCase().includes(q);
          }).map((k) => {
            const row = langMap[k] ?? {};
            const setEntry = (lang: "TK" | "MN", v: string) =>
              setLangMap((m) => {
                const next = { ...m, [k]: { ...m[k], [lang]: v || undefined } };
                if (!next[k]?.TK && !next[k]?.MN) delete next[k];
                return next;
              });
            return (
              <div key={k} className="rounded-xl border p-2.5">
                <p className="text-xs font-medium leading-snug">{CORE_STRINGS[k]}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{k}</p>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <Input
                    value={row.TK ?? ""}
                    onChange={(e) => setEntry("TK", e.target.value)}
                    placeholder="Tangkhul"
                    aria-label={`Tangkhul for: ${CORE_STRINGS[k]}`}
                    className="h-9 rounded-lg text-sm"
                  />
                  <Input
                    value={row.MN ?? ""}
                    onChange={(e) => setEntry("MN", e.target.value)}
                    placeholder="Meiteilon"
                    aria-label={`Meiteilon for: ${CORE_STRINGS[k]}`}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
              </div>
            );
          })}
          {CORE_KEYS.every((k) => {
            const en = CORE_STRINGS[k];
            const q = langQ.trim().toLowerCase();
            return q && !k.toLowerCase().includes(q) && !en.toLowerCase().includes(q);
          }) ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No strings match “{langQ}”.
            </p>
          ) : null}
        </div>

        <Button
          onClick={() => void save({ langOverrides: langMap })}
          disabled={busy}
          className="mt-3 rounded-full px-6"
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Save translations
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Saved strings appear on the site instantly — no deploy needed.
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard shell ─────────────────────────────────────────────

const CONTENT_MOTION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

export function AdminDashboard() {
  const user = useStore((s) => s.user);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const listingsVersion = useStore((s) => s.listingsVersion);
  const [counts, setCounts] = useState<Partial<Record<ListingMode, number>> | null>(null);
  const [tab, setTab] = useState("overview");

  /** Switch sections and bring the new one to the top (phones have no tab strip in view). */
  const switchTab = useCallback((key: string) => {
    setTab(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Per-vertical listing counts for the panel switcher.
  useEffect(() => {
    let alive = true;
    Promise.all([adminApi.getStats("HOME"), adminApi.getStats("BUSINESS")])
      .then(([h, b]) => {
        if (!alive) return;
        setCounts({ HOME: h.properties.total, BUSINESS: b.properties.total });
      })
      .catch(() => {
        // counts are decorative — leave them blank on failure
      });
    return () => {
      alive = false;
    };
  }, [listingsVersion]);

  if (!user) return null;
  const business = mode === "BUSINESS";

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* God-mode header — washes emerald or amber with the active panel */}
      <div className="relative overflow-hidden rounded-3xl border bg-card shadow-sm">
        <motion.div
          aria-hidden
          animate={{ opacity: business ? 0 : 1 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-transparent to-emerald-500/5"
        />
        <motion.div
          aria-hidden
          animate={{ opacity: business ? 1 : 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-transparent to-orange-500/5"
        />
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
              <ShieldCheck className="size-3.5" aria-hidden />
              God Mode
            </span>
            <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {user.name}
            </span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl"
            >
              {business ? "iShim Business" : "iShim"} control centre
            </motion.h2>
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`sub-${mode}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, delay: 0.03 }}
              className="mt-1 max-w-xl text-sm text-muted-foreground"
            >
              {business
                ? "Shops, offices and cafes — approvals, listings, fees and pricing for the business vertical."
                : "Houses and apartments — approvals, listings, fees and pricing for the homes vertical."}{" "}
              Users, ads and content stay shared.
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky panel discretion switcher — flip vertical anywhere on the page */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-border/60 bg-background/85 px-4 py-2 backdrop-blur-xl md:top-16 md:mx-0 md:rounded-2xl md:border md:border-border/60 md:bg-background/80 md:px-3 md:shadow-sm">
        <VerticalSwitch
          value={mode}
          onChange={setMode}
          size="sm"
          counts={counts ?? undefined}
          label="God mode panel — iShim or iShim Business"
        />
      </div>

      {/* Mobile: grid of icon tiles (no hidden overflow). Desktop: pill row. */}
      <PanelTabGrid tabs={PANEL_TABS} value={tab} onChange={switchTab} />

      <Tabs value={tab} onValueChange={switchTab} className="gap-5">
        <TabsList className="hidden h-auto w-auto items-center gap-1 rounded-full bg-muted p-1 sm:flex">
          {PANEL_TABS.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="min-h-9 rounded-full px-4 text-sm"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <motion.div key={`ov-${mode}`} {...CONTENT_MOTION}>
            <OverviewTab mode={mode} />
          </motion.div>
        </TabsContent>
        <TabsContent value="leads">
          <LeadsTab />
        </TabsContent>
        <TabsContent value="insights">
          <AdminInsightsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="properties">
          <motion.div key={`pr-${mode}`} {...CONTENT_MOTION} className="space-y-6">
            {/* Pending/rejected review lives at the top of Listings now */}
            <ApprovalsTab mode={mode} />
            <PropertiesTab mode={mode} />
          </motion.div>
        </TabsContent>
        <TabsContent value="financials">
          <motion.div key={`fi-${mode}`} {...CONTENT_MOTION}>
            <FinancialsTab mode={mode} />
          </motion.div>
        </TabsContent>
        <TabsContent value="areas">
          {/* One simple home for everything area-related */}
          <div className="space-y-4">
            <AreaRequestsCard />
            <WardManager />
          </div>
        </TabsContent>
        <TabsContent value="content">
          {/* Ads + pages merged — one Content tab */}
          <div className="space-y-6">
            <AdsTab />
            <ContentTab />
          </div>
        </TabsContent>
        <TabsContent value="settings">
          <motion.div key={`se-${mode}`} {...CONTENT_MOTION}>
            <SettingsTab />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
