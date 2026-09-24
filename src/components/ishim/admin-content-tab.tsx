"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  FileText,
  HelpCircle,
  Info,
  LifeBuoy,
  Loader2,
  MessageCircle,
  Plus,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "./empty-state";
import { UploadButton } from "./upload-button";
import { adminApi } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/feedback";
import {
  DEFAULT_CONTENT,
  type AboutData,
  type ContactData,
  type ContentData,
  type ContentPageDto,
  type FaqData,
  type HelpArticleKey,
  type HowData,
  type SectionsData,
} from "@/lib/default-content";

const ICONS: Record<HelpArticleKey, typeof Info> = {
  how: HelpCircle,
  about: Info,
  contact: MessageCircle,
  support: LifeBuoy,
  privacy: ShieldCheck,
  terms: FileText,
  policy: ScrollText,
  business: Building2,
};

const DESCRIPTIONS: Record<HelpArticleKey, string> = {
  how: "The three-step tour shown in the help widget.",
  about: "Who iShim is, shown in the help widget.",
  contact: "WhatsApp number, email, location and hours.",
  support: "Frequently asked questions with answers.",
  privacy: "The privacy policy renters and owners see.",
  terms: "The Terms & Conditions of using iShim.",
  policy: "Listing rules and the success-fee policy.",
  business: "The business side — eX Holdings, agents and partners.",
};

/* ──────────────────────────────────────────────────────────────────── */
/* Dynamic row helpers                                                  */

function RowRemove({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Remove row"
      onClick={onClick}
      className="size-9 shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
    >
      <Trash2 aria-hidden />
    </Button>
  );
}

function AddRow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className="rounded-full"
    >
      <Plus aria-hidden />
      {label}
    </Button>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Type-aware editors — each mutates a draft object via `patch`         */

function HowEditor({
  data,
  patch,
}: {
  data: HowData;
  patch: (d: Partial<HowData>) => void;
}) {
  const setStep = (i: number, k: "title" | "body", v: string) => {
    const steps = data.steps.map((s, j) => (j === i ? { ...s, [k]: v } : s));
    patch({ steps });
  };
  return (
    <div className="space-y-3">
      {data.steps.map((s, i) => (
        <div key={i} className="rounded-2xl border border-border/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Step {i + 1}</Label>
            {data.steps.length > 1 && (
              <RowRemove
                onClick={() =>
                  patch({ steps: data.steps.filter((_, j) => j !== i) })
                }
              />
            )}
          </div>
          <Input
            value={s.title}
            onChange={(e) => setStep(i, "title", e.target.value)}
            placeholder="Step title"
            className="mt-1.5"
          />
          <Textarea
            value={s.body}
            onChange={(e) => setStep(i, "body", e.target.value)}
            placeholder="What happens in this step"
            rows={2}
            className="mt-2"
          />
        </div>
      ))}
      <AddRow
        label="Add step"
        onClick={() => patch({ steps: [...data.steps, { title: "", body: "" }] })}
      />
      <div className="space-y-1.5">
        <Label htmlFor="how-note">Highlight note</Label>
        <Textarea
          id="how-note"
          value={data.note}
          onChange={(e) => patch({ note: e.target.value })}
          rows={2}
          placeholder="e.g. Free for 36 months • ₹1,000 only on success."
        />
      </div>
    </div>
  );
}

function AboutEditor({
  data,
  patch,
}: {
  data: AboutData;
  patch: (d: Partial<AboutData>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="about-lead">Lead paragraph</Label>
        <Textarea
          id="about-lead"
          value={data.lead}
          onChange={(e) => patch({ lead: e.target.value })}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Checklist bullets</Label>
        {data.bullets.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={b}
              onChange={(e) =>
                patch({
                  bullets: data.bullets.map((x, j) => (j === i ? e.target.value : x)),
                })
              }
              placeholder="Bullet point"
            />
            <RowRemove
              onClick={() =>
                patch({ bullets: data.bullets.filter((_, j) => j !== i) })
              }
            />
          </div>
        ))}
        <AddRow
          label="Add bullet"
          onClick={() => patch({ bullets: [...data.bullets, ""] })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="about-outro">Closing line</Label>
        <Textarea
          id="about-outro"
          value={data.outro}
          onChange={(e) => patch({ outro: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );
}

function ContactEditor({
  data,
  patch,
}: {
  data: ContactData;
  patch: (d: Partial<ContactData>) => void;
}) {
  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder?: string
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="contact-lead">Intro line</Label>
        <Textarea
          id="contact-lead"
          value={data.lead}
          onChange={(e) => patch({ lead: e.target.value })}
          rows={2}
        />
      </div>
      <div className="rounded-2xl border border-border/70 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          WhatsApp row
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {field("Label", data.whatsapp.label, (v) =>
            patch({ whatsapp: { ...data.whatsapp, label: v } })
          )}
          {field(
            "Number (with country code)",
            data.whatsapp.number,
            (v) => patch({ whatsapp: { ...data.whatsapp, number: v } }),
            "919000000001"
          )}
          <div className="sm:col-span-2">
            {field("Sub-line", data.whatsapp.sub, (v) =>
              patch({ whatsapp: { ...data.whatsapp, sub: v } })
            )}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/70 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Email row
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {field("Label", data.email.label, (v) =>
            patch({ email: { ...data.email, label: v } })
          )}
          {field("Address", data.email.address, (v) =>
            patch({ email: { ...data.email, address: v, sub: v } })
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Location row
          </p>
          <div className="space-y-2">
            {field("Label", data.location.label, (v) =>
              patch({ location: { ...data.location, label: v } })
            )}
            {field("Sub-line", data.location.sub, (v) =>
              patch({ location: { ...data.location, sub: v } })
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Hours row
          </p>
          <div className="space-y-2">
            {field("Label", data.hours.label, (v) =>
              patch({ hours: { ...data.hours, label: v } })
            )}
            {field("Sub-line", data.hours.sub, (v) =>
              patch({ hours: { ...data.hours, sub: v } })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqEditor({
  data,
  patch,
}: {
  data: FaqData;
  patch: (d: Partial<FaqData>) => void;
}) {
  const set = (i: number, k: "q" | "a", v: string) =>
    patch({ faqs: data.faqs.map((f, j) => (j === i ? { ...f, [k]: v } : f)) });
  return (
    <div className="space-y-3">
      {data.faqs.map((f, i) => (
        <div key={i} className="rounded-2xl border border-border/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">FAQ {i + 1}</Label>
            {data.faqs.length > 1 && (
              <RowRemove
                onClick={() => patch({ faqs: data.faqs.filter((_, j) => j !== i) })}
              />
            )}
          </div>
          <Input
            value={f.q}
            onChange={(e) => set(i, "q", e.target.value)}
            placeholder="Question"
            className="mt-1.5"
          />
          <Textarea
            value={f.a}
            onChange={(e) => set(i, "a", e.target.value)}
            placeholder="Answer"
            rows={3}
            className="mt-2"
          />
        </div>
      ))}
      <AddRow
        label="Add FAQ"
        onClick={() => patch({ faqs: [...data.faqs, { q: "", a: "" }] })}
      />
    </div>
  );
}

function SectionsEditor({
  data,
  patch,
}: {
  data: SectionsData;
  patch: (d: Partial<SectionsData>) => void;
}) {
  const set = (i: number, k: "h" | "p", v: string) =>
    patch({
      sections: data.sections.map((s, j) => (j === i ? { ...s, [k]: v } : s)),
    });
  return (
    <div className="space-y-3">
      {data.sections.map((s, i) => (
        <div key={i} className="rounded-2xl border border-border/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">
              Section {i + 1}
            </Label>
            {data.sections.length > 1 && (
              <RowRemove
                onClick={() =>
                  patch({ sections: data.sections.filter((_, j) => j !== i) })
                }
              />
            )}
          </div>
          <Input
            value={s.h}
            onChange={(e) => set(i, "h", e.target.value)}
            placeholder="Heading"
            className="mt-1.5"
          />
          <Textarea
            value={s.p}
            onChange={(e) => set(i, "p", e.target.value)}
            placeholder="Text"
            rows={3}
            className="mt-2"
          />
        </div>
      ))}
      <AddRow
        label="Add section"
        onClick={() => patch({ sections: [...data.sections, { h: "", p: "" }] })}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Editor dialog                                                        */

function ContentEditorDialog({
  page,
  onClose,
  onSaved,
}: {
  page: ContentPageDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [banner, setBanner] = useState(page.banner);
  const [data, setData] = useState<ContentData>(
    JSON.parse(JSON.stringify(page.data)) as ContentData
  );
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.upsertContent(page.slug, { title, data, banner });
      toastSuccess("Content published", `${title} is live for everyone.`);
      onSaved();
    } catch (e) {
      toastError(e, "Could not save content");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setResetting(true);
    try {
      await adminApi.resetContent(page.slug);
      toastSuccess("Reset to default", `${DEFAULT_CONTENT[page.slug].title} restored.`);
      onSaved();
    } catch (e) {
      toastError(e, "Could not reset content");
      setResetting(false);
    }
  };

  const patch = (d: Partial<ContentData>) =>
    setData((prev) => ({ ...prev, ...d }) as ContentData);

  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {(() => {
            const Icon = ICONS[page.slug];
            return <Icon className="size-5 text-primary" aria-hidden />;
          })()}
          Edit “{DEFAULT_CONTENT[page.slug].title}”
        </DialogTitle>
        <DialogDescription>
          {DESCRIPTIONS[page.slug]} Changes go live everywhere instantly.
          {page.customized ? " This page is customized." : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="content-title">Title</Label>
          <Input
            id="content-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Banner image (optional)
          </Label>
          {banner ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border/70 p-2">
              <img
                src={banner}
                alt="Banner preview"
                className="h-14 w-24 rounded-xl border border-border/60 object-cover"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBanner("")}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden />
                Remove
              </Button>
            </div>
          ) : (
            <UploadButton
              label="Upload banner"
              onUploaded={(url) => setBanner(url)}
            />
          )}
        </div>

        {page.slug === "how" && (
          <HowEditor data={data as HowData} patch={patch} />
        )}
        {page.slug === "about" && (
          <AboutEditor data={data as AboutData} patch={patch} />
        )}
        {page.slug === "contact" && (
          <ContactEditor data={data as ContactData} patch={patch} />
        )}
        {page.slug === "support" && (
          <FaqEditor data={data as FaqData} patch={patch} />
        )}
        {(page.slug === "privacy" ||
          page.slug === "terms" ||
          page.slug === "policy" ||
          page.slug === "business") && (
          <SectionsEditor data={data as SectionsData} patch={patch} />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="flex-1 rounded-full sm:flex-none"
        >
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Publish
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={busy}
          className="rounded-full"
        >
          Cancel
        </Button>
        {page.customized && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => void reset()}
            disabled={resetting || busy}
            className="ml-auto rounded-full text-muted-foreground hover:text-destructive"
          >
            {resetting ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <RotateCcw aria-hidden />
            )}
            Reset to default
          </Button>
        )}
      </div>
    </DialogContent>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Tab                                                                  */

export function ContentTab() {
  const [pages, setPages] = useState<ContentPageDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContentPageDto | null>(null);

  const load = () => {
    adminApi
      .listContent()
      .then((res) => {
        setPages(res.pages);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Could not load content");
      });
  };

  useEffect(load, []);

  const toggleVisible = (p: ContentPageDto, visible: boolean) => {
    setPages(
      (prev) =>
        prev?.map((x) => (x.slug === p.slug ? { ...x, visible } : x)) ?? prev
    );
    adminApi
      .setContentVisible(p.slug, visible)
      .then(() =>
        toastSuccess(
          visible ? "Page is on" : "Page is off",
          visible
            ? `${p.title} is visible to everyone again.`
            : `${p.title} was removed from the help menu.`
        )
      )
      .catch((e: unknown) => {
        toastError(e, "Could not update visibility");
        load();
      });
  };

  if (pages === null) {
    return error ? (
      <EmptyState
        icon={FileText}
        title="Couldn't load content"
        description={error}
        actionLabel="Retry"
        onAction={() => void load()}
      />
    ) : (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </div>
    );
  }

  const customizedCount = pages.filter((p) => p.customized).length;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border/60 bg-card p-5">
        <h3 className="font-semibold tracking-tight">Pages & legal content</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Edit what the whole site reads — help articles, policies and contact
          details. Use the switch to turn any page on or off for visitors.{" "}
          {customizedCount > 0
            ? `${customizedCount} of ${pages.length} pages customized.`
            : "Everything is still on the default copy."}
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card">
        {pages.map((p, i) => {
          const Icon = ICONS[p.slug];
          return (
            <div
              key={p.slug}
              className={`flex items-center gap-3 p-4 ${
                i > 0 ? "border-t border-border/60" : ""
              }`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Icon className="size-4 text-primary" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`truncate text-sm font-medium ${p.visible ? "" : "text-muted-foreground"}`}>
                    {p.title}
                  </p>
                  {!p.visible ? (
                    <Badge variant="outline" className="rounded-full border-destructive/30 text-destructive">
                      Off
                    </Badge>
                  ) : p.customized ? (
                    <Badge className="rounded-full bg-primary/10 text-primary" variant="secondary">
                      Customized
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full text-muted-foreground">
                      Default
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {p.customized
                    ? `Edited by ${p.updatedBy || "admin"} · ${p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ""}`
                    : DESCRIPTIONS[p.slug]}
                </p>
              </div>
              <Switch
                checked={p.visible}
                onCheckedChange={(v) => toggleVisible(p, v)}
                aria-label={`${p.visible ? "Hide" : "Show"} ${p.title} on the site`}
              />
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setEditing(p)}
              >
                Edit
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <ContentEditorDialog
            key={`${editing.slug}-${editing.updatedAt ?? "default"}`}
            page={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              void load();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
