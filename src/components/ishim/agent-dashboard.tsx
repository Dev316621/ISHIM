"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Handshake,
  Inbox,
  ClipboardList,
  KanbanSquare,
  Loader2,
  LogIn,
  MessageCircle,
  NotebookPen,
  Phone,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentInsightsTab } from "./insights";
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
import { ListingsList } from "./listings-list";
import { EnquiriesInbox } from "./enquiries-inbox";
import { IntakeTab } from "./intake-tab";
import { PanelTabGrid, type PanelTab } from "./panel-tab-grid";
import { EmptyState } from "./empty-state";
import { VerticalSwitch } from "./vertical-switch";
import { useStore } from "@/lib/store";
import { agentApi, leadsApi, ownerApi, publicApi } from "@/lib/api";
import { impersonateUser } from "@/lib/impersonate";
import { toastError, toastSuccess } from "@/lib/feedback";
import {
  HOUSE_TYPE_LABELS,
  ROLE_LABELS,
  STAGES,
  STAGE_LABELS,
  formatRent,
  type AgentAccount,
  type AgentClientLead,
  type AgentOwnerLink,
  type AgentStage,
  type ListingMode,
  type MatchResult,
  type Property,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STAGE_DOT: Record<AgentStage, string> = {
  NEW_LEAD: "bg-emerald-500",
  SITE_VISIT: "bg-amber-500",
  NEGOTIATING: "bg-orange-600",
  CLOSED: "bg-primary",
  LOST: "bg-muted-foreground/40",
};

function stageOf(stage: AgentStage) {
  return STAGE_LABELS[stage] ?? stage;
}

// ─── Pipeline ────────────────────────────────────────────────────

function LeadCard({ lead, onStageChange }: { lead: AgentClientLead; onStageChange: (lead: AgentClientLead, stage: AgentStage) => void }) {
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{lead.name}</p>
          <a
            href={`tel:${lead.phone}`}
            className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <Phone className="size-3" aria-hidden /> {lead.phone}
          </a>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Move ${lead.name} to another stage`}
              className="flex min-h-8 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={cn("size-2 rounded-full", STAGE_DOT[lead.stage])} aria-hidden />
              {stageOf(lead.stage)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs">Move to stage</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STAGES.map((s) => (
              <DropdownMenuItem
                key={s}
                disabled={s === lead.stage}
                onClick={() => onStageChange(lead, s)}
                className={cn(s === lead.stage && "text-primary")}
              >
                <span className={cn("size-2 rounded-full", STAGE_DOT[s])} aria-hidden />
                {STAGE_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Badge variant="secondary" className="rounded-full font-normal">
          {formatRent(lead.budgetMin)}–{formatRent(lead.budgetMax)}
        </Badge>
        {lead.preferredBlock ? (
          <Badge variant="secondary" className="rounded-full font-normal">
            {lead.preferredBlock}
          </Badge>
        ) : null}
        {lead.preferredType && lead.preferredType !== "ANY" ? (
          <Badge variant="secondary" className="rounded-full font-normal">
            {HOUSE_TYPE_LABELS[lead.preferredType] ?? lead.preferredType}
          </Badge>
        ) : null}
      </div>
      {lead.notes ? (
        <p className="mt-2 line-clamp-2 rounded-xl bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
          {lead.notes}
        </p>
      ) : null}
    </div>
  );
}

function PipelineTab() {
  const [leads, setLeads] = useState<AgentClientLead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    agentApi
      .getClients()
      .then((data) => {
        setLeads(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load leads"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeStage = async (lead: AgentClientLead, stage: AgentStage) => {
    setLeads((list) => (list ? list.map((l) => (l.id === lead.id ? { ...l, stage } : l)) : list));
    try {
      await agentApi.updateClient(lead.id, { stage });
      toastSuccess(`${lead.name} → ${STAGE_LABELS[stage]}`);
    } catch (e) {
      toastError(e, "Could not move lead");
      load();
    }
  };

  if (error) {
    return (
      <EmptyState icon={TriangleAlert} title="Couldn't load your pipeline" description={error} actionLabel="Retry" onAction={load} />
    );
  }

  if (leads === null) {
    return (
      <div className="grid grid-flow-col auto-cols-[minmax(15rem,1fr)] gap-3 overflow-x-auto pb-2 md:grid-cols-5 md:grid-flow-row">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {leads.length} {leads.length === 1 ? "lead" : "leads"} across the pipeline
        </p>
        <Button onClick={() => setAddOpen(true)} className="rounded-full">
          <Plus aria-hidden /> Add Lead
        </Button>
      </div>
      <div className="grid grid-flow-col auto-cols-[minmax(16rem,1fr)] gap-3 overflow-x-auto pb-2 thin-scrollbar md:grid-flow-row md:grid-cols-5 md:overflow-visible">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage);
          return (
            <section key={stage} aria-label={STAGE_LABELS[stage]} className="min-w-0">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                <span className={cn("size-2 rounded-full", STAGE_DOT[stage])} aria-hidden />
                {STAGE_LABELS[stage]}
                <span className="text-xs font-normal text-muted-foreground">{stageLeads.length}</span>
              </h3>
              <div className={cn("space-y-2 rounded-2xl", stage === "CLOSED" || stage === "LOST" ? "" : "bg-muted/40 p-2")}>
                {stageLeads.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">No leads here.</p>
                ) : (
                  stageLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onStageChange={changeStage} />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
      <AddLeadDialog open={addOpen} onOpenChange={setAddOpen} onCreated={load} />
    </div>
  );
}

function AddLeadDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const settings = useStore((s) => s.settings);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [block, setBlock] = useState("ANY");
  const [type, setType] = useState("ANY");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setBudgetMin("");
      setBudgetMax("");
      setBlock("ANY");
      setType("ANY");
      setNotes("");
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) {
      toastError(new Error("Name and phone are required."));
      return;
    }
    setBusy(true);
    try {
      await agentApi.createClient({
        name: name.trim(),
        phone: phone.trim(),
        budgetMin: Number(budgetMin) || 0,
        budgetMax: Number(budgetMax) || 0,
        preferredBlock: block === "ANY" ? "" : block,
        preferredType: type,
        notes: notes.trim(),
      });
      toastSuccess("Lead added", `${name} joined your pipeline.`);
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toastError(e, "Could not add lead");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl thin-scrollbar sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Add a client lead</DialogTitle>
          <DialogDescription>Track tenants looking for homes and move them through your pipeline.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="al-name">Name *</Label>
            <Input id="al-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Reina Luithui" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="al-phone">Phone *</Label>
            <Input id="al-phone" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9856033441" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="al-min">Budget min (₹)</Label>
            <Input id="al-min" type="number" inputMode="numeric" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="0" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="al-max">Budget max (₹)</Label>
            <Input id="al-max" type="number" inputMode="numeric" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="0" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Preferred block</Label>
            <Select value={block} onValueChange={setBlock}>
              <SelectTrigger aria-label="Preferred block" className="h-11 rounded-xl">
                <SelectValue />
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
            <Label>Preferred type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger aria-label="Preferred house type" className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">Any type</SelectItem>
                <SelectItem value="ASSAM_TYPE">Assam-type</SelectItem>
                <SelectItem value="RCC">RCC</SelectItem>
                <SelectItem value="KUTCHA">Kutcha</SelectItem>
                <SelectItem value="APARTMENT">Apartment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="al-notes">Notes</Label>
            <Textarea id="al-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Occupation, move-in date, family size…" className="rounded-xl" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} className="rounded-full px-6">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
            Add lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Log in as — any owner or client account ────────────────────

function AccountSearchResults({ q }: { q: string }) {
  const [results, setResults] = useState<AgentAccount[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const query = q.trim();

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (query.length < 2) {
        setResults(null);
        return;
      }
      agentApi
        .searchUsers(query)
        .then((d) => setResults(d.users))
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const login = async (u: AgentAccount) => {
    setBusyId(u.id);
    await impersonateUser(u.id, u.name);
    setBusyId(null);
  };

  if (query.length < 2) return null;

  return (
    <div aria-live="polite">
      {results === null ? (
        <Skeleton className="h-14 rounded-xl" />
      ) : results.length === 0 ? (
        <p className="rounded-xl bg-background px-3 py-2.5 text-sm text-muted-foreground">
          No owner or client account matches “{query}”.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {results.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-background px-3 py-2"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {u.name}
                  {u.verified ? <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified" /> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {ROLE_LABELS[u.role]} · {u.phone}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busyId === u.id}
                onClick={() => void login(u)}
                className="min-h-9 shrink-0 rounded-full"
              >
                {busyId === u.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogIn aria-hidden />}
                Log in as
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Owners ──────────────────────────────────────────────────────

function OwnersTab() {
  const [links, setLinks] = useState<AgentOwnerLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    agentApi
      .getOwners()
      .then((data) => {
        setLinks(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load owners"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <EmptyState icon={TriangleAlert} title="Couldn't load your owners" description={error} actionLabel="Retry" onAction={load} />
    );
  }

  if (links === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-40 rounded-full" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Owners whose homes you manage</p>
        <Button onClick={() => setLinkOpen(true)} className="min-h-10 rounded-full">
          <Plus aria-hidden /> Link Owner
        </Button>
      </div>

      {/* Enter any owner's or client's account to help them */}
      <div className="space-y-2 rounded-2xl border border-dashed bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Help any owner or client — find their account and log in as them:
        </p>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or phone…"
            aria-label="Search owner or client accounts"
            className="h-11 rounded-full pl-10"
          />
        </div>
        <AccountSearchResults q={q} />
      </div>

      {links.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No owners linked yet"
          description="Link an owner by phone number to manage their properties and keep private notes."
          actionLabel="Link an owner"
          onAction={() => setLinkOpen(true)}
        />
      ) : (
        <ul className="space-y-3">
          {links.map((l) => (
            <OwnerLinkCard key={l.link.id} link={l} onChanged={load} />
          ))}
        </ul>
      )}
      <LinkOwnerDialog open={linkOpen} onOpenChange={setLinkOpen} onLinked={load} />
    </div>
  );
}

function OwnerLinkCard({ link, onChanged }: { link: AgentOwnerLink; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await agentApi.addOwnerNote(link.link.id, note.trim());
      setNote("");
      toastSuccess("Note saved", "Only you can see this note.");
      onChanged();
    } catch (e) {
      toastError(e, "Could not save note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
            {link.owner.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="flex items-center gap-1.5 font-medium">
              {link.owner.name}
              {link.owner.verified ? <BadgeCheck className="size-4 text-primary" aria-label="Verified" /> : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {link.owner.phone} · {link.properties.length} {link.properties.length === 1 ? "listing" : "listings"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="min-h-9 rounded-full"
            onClick={() => void impersonateUser(link.owner.id, link.owner.name)}
          >
            <LogIn aria-hidden />
            Log in as
          </Button>
          <Button size="sm" variant="secondary" className="min-h-9 rounded-full" onClick={() => setExpanded((v) => !v)}>
            <NotebookPen aria-hidden />
            {expanded ? "Hide notes" : `Notes (${link.notes.length})`}
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2 border-t pt-3">
          <ul className="max-h-40 space-y-1.5 overflow-y-auto thin-scrollbar pr-1">
            {link.notes.length === 0 ? (
              <li className="text-xs text-muted-foreground">No private notes yet.</li>
            ) : (
              link.notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-muted/60 px-3 py-2 text-xs">
                  {n.text}
                  <span className="ml-1.5 text-muted-foreground/70">
                    {new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </li>
              ))
            )}
          </ul>
          <div className="flex gap-2">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addNote();
                }
              }}
              placeholder="Private note about this owner…"
              className="h-10 rounded-xl"
            />
            <Button size="sm" onClick={addNote} disabled={busy || !note.trim()} className="h-10 shrink-0 rounded-xl">
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function LinkOwnerDialog({
  open,
  onOpenChange,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLinked: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone("");
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    if (!phone.trim()) {
      toastError(new Error("Enter the owner's phone number."));
      return;
    }
    setBusy(true);
    try {
      await agentApi.linkOwner(phone.trim());
      toastSuccess("Owner linked", "Their listings can now be managed from your dashboard.");
      onLinked();
      onOpenChange(false);
    } catch (e) {
      toastError(e, "Could not link owner");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">Link an owner</DialogTitle>
          <DialogDescription>
            Enter their phone number. If they haven't joined iShim yet, an owner account is created for them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="lo-phone">Owner phone *</Label>
          <Input
            id="lo-phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="e.g. 9856001101"
            className="h-11 rounded-xl"
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} className="w-full rounded-full">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Handshake aria-hidden />}
            Link owner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Listings ────────────────────────────────────────────────────

function ListingsTab({
  mode,
  properties,
  error,
  onRetry,
}: {
  mode: ListingMode;
  properties: Property[] | null;
  error: string | null;
  onRetry: () => void;
}) {
  const openListing = useStore((s) => s.openListing);
  const business = mode === "BUSINESS";

  if (error) {
    return <EmptyState icon={TriangleAlert} title="Couldn't load listings" description={error} actionLabel="Retry" onAction={onRetry} />;
  }

  if (properties === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-44 rounded-full" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  // Panel discretion — only the active vertical's listings.
  const filtered = properties.filter((p) =>
    business ? p.mode === "BUSINESS" : p.mode !== "BUSINESS"
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {business
            ? "Business spaces you list — yours and on behalf of owners"
            : "Homes you list — yours and on behalf of owners"}
        </p>
        <Button onClick={() => openListing()} className="rounded-full">
          <Plus aria-hidden /> Add {business ? "Business" : "Home"}
        </Button>
      </div>
      <ListingsList properties={filtered} onEdit={openListing} />
    </div>
  );
}

// ─── Matchmaking ─────────────────────────────────────────────────

function MatchmakingTab({ mode }: { mode: ListingMode }) {
  const openProperty = useStore((s) => s.openProperty);
  const addRecentContact = useStore((s) => s.addRecentContact);
  const [leads, setLeads] = useState<AgentClientLead[] | null>(null);
  const [selected, setSelected] = useState("");
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const business = mode === "BUSINESS";

  const busy = !!selected && loadedFor !== selected;

  useEffect(() => {
    agentApi
      .getClients()
      .then((list) => {
        setLeads(list);
        if (list.length > 0) setSelected((cur) => cur || list[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load clients"));
  }, []);

  const runMatch = useCallback(
    async (clientId: string) => {
      try {
        const res = await agentApi.match(clientId);
        setMatches(res.matches);
      } catch (e) {
        toastError(e, "Matchmaking failed");
      } finally {
        setLoadedFor(clientId);
      }
    },
    []
  );

  useEffect(() => {
    if (selected) void runMatch(selected);
  }, [selected, runMatch]);

  const contact = async (m: MatchResult) => {
    try {
      const { waLink } = await publicApi.contactProperty(m.id);
      addRecentContact({
        propertyId: m.id,
        title: m.title,
        block: m.block,
        rent: m.rent,
        at: new Date().toISOString(),
      });
      window.open(waLink, "_blank", "noopener,noreferrer");
    } catch (e) {
      toastError(e, "Could not open WhatsApp");
    }
  };

  if (error) return <EmptyState icon={TriangleAlert} title="Couldn't load matchmaking" description={error} />;

  const client = leads?.find((l) => l.id === selected);
  // Panel discretion — only show matches from the active vertical.
  const visibleMatches =
    matches === null ? null : matches.filter((m) => (m.mode ?? "HOME") === mode);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="mm-client">Find {business ? "spaces" : "homes"} for client</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger id="mm-client" aria-label="Select client" className="h-11 rounded-xl">
              <SelectValue placeholder={leads?.length ? "Select a client" : "No clients yet"} />
            </SelectTrigger>
            <SelectContent>
              {(leads ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} · {l.preferredBlock || "Any block"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {client ? (
          <div className="flex flex-wrap gap-1.5 sm:pt-5">
            <Badge variant="secondary" className="rounded-full font-normal">
              {formatRent(client.budgetMin)}–{formatRent(client.budgetMax)}/mo
            </Badge>
            {client.preferredType && client.preferredType !== "ANY" ? (
              <Badge variant="secondary" className="rounded-full font-normal">
                {HOUSE_TYPE_LABELS[client.preferredType] ?? client.preferredType}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      {busy ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : visibleMatches !== null && visibleMatches.length === 0 ? (
        <EmptyState
          icon={Search}
          title={business ? "No business matches right now" : "No matches right now"}
          description={
            business
              ? "No active shops, offices or cafes fit this client's budget and preferences yet."
              : "No active homes fit this client's budget and preferences yet. New approvals will match automatically."
          }
        />
      ) : visibleMatches !== null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleMatches.map((m) => (
            <div key={m.id} className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openProperty(m.id)}
                  className="text-left font-medium leading-snug hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                >
                  {m.title}
                </button>
                {m.score !== undefined ? (
                  <Badge className="shrink-0 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <Sparkles className="size-3" aria-hidden />
                    {Math.round(m.score)}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {m.block} · {HOUSE_TYPE_LABELS[m.houseType] ?? m.houseType} · {formatRent(m.rent)}/mo
              </p>
              <p className="mt-2 flex-1 rounded-xl bg-secondary/70 px-3 py-2 text-xs text-secondary-foreground">{m.reason}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => void contact(m)} className="min-h-9 flex-1 rounded-full">
                  <MessageCircle aria-hidden /> WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={() => openProperty(m.id)} className="min-h-9 rounded-full">
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Dashboard shell ─────────────────────────────────────────────

const PANEL_TABS: PanelTab[] = [
  { key: "pipeline", label: "Clients", icon: KanbanSquare },
  { key: "intake", label: "New homes", icon: ClipboardList },
  { key: "enquiries", label: "Inbox", icon: Inbox },
  { key: "owners", label: "Owners", icon: Handshake },
  { key: "listings", label: "Listings", icon: Building2 },
  { key: "matchmaking", label: "Matches", icon: Sparkles },
  { key: "demand", label: "Insights", icon: TrendingUp },
];

export function AgentDashboard() {
  const user = useStore((s) => s.user);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const listingsVersion = useStore((s) => s.listingsVersion);
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("pipeline");
  const [newRequests, setNewRequests] = useState(0);
  const business = mode === "BUSINESS";

  /** Switch sections and bring the new one to the top (phones have no tab strip in view). */
  const switchTab = useCallback((key: string) => {
    setTab(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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

  // Badge count for the "New homes" tile — listing requests nobody has
  // claimed yet. Cheap single fetch on mount + after listing changes.
  useEffect(() => {
    let alive = true;
    leadsApi
      .list("NEW")
      .then((d) => {
        if (alive) setNewRequests(d.items.length);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [listingsVersion]);

  const tabs = PANEL_TABS;

  if (!user) return null;

  const businessCount = (properties ?? []).filter((p) => p.mode === "BUSINESS").length;
  const homeCount = (properties ?? []).length - businessCount;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* iShim ⇄ iShim Business panel discretion */}
      <div className="flex flex-col gap-3 rounded-3xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">
            {business ? "iShim Business" : "iShim"} — Agent CRM
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Leads, listings and matchmaking for the{" "}
            {business ? "business vertical" : "homes vertical"} — owners and
            pipeline stay shared.
          </p>
        </div>
        <VerticalSwitch
          value={mode}
          onChange={setMode}
          size="md"
          counts={{ HOME: homeCount, BUSINESS: businessCount }}
          label="Agent panel — homes or business"
          className="sm:w-72"
        />
      </div>
      {/* Mobile: grid of icon tiles (no hidden overflow). Desktop: pill row. */}
      <PanelTabGrid
        tabs={PANEL_TABS.map((t) =>
          t.key === "intake" ? { ...t, badge: newRequests || undefined } : t
        )}
        value={tab}
        onChange={switchTab}
      />

      <Tabs value={tab} onValueChange={switchTab} className="gap-5">
        <TabsList className="hidden h-auto w-auto items-center gap-1 rounded-full bg-muted p-1 sm:flex">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="min-h-9 rounded-full px-4 text-sm"
            >
              {t.label}
              {t.key === "intake" && newRequests > 0 ? (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                  {newRequests}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="pipeline">
          <PipelineTab />
        </TabsContent>
        <TabsContent value="intake">
          <IntakeTab />
        </TabsContent>
        <TabsContent value="enquiries">
          <EnquiriesInbox mode={mode} />
        </TabsContent>
        <TabsContent value="owners">
          <OwnersTab />
        </TabsContent>
        <TabsContent value="listings">
          <ListingsTab mode={mode} properties={properties} error={error} onRetry={load} />
        </TabsContent>
        <TabsContent value="matchmaking">
          <MatchmakingTab mode={mode} />
        </TabsContent>
        <TabsContent value="demand">
          <AgentInsightsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
