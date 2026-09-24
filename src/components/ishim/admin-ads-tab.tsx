"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Photo } from "./photo";
import { EmptyState } from "./empty-state";
import { UploadButton } from "./upload-button";
import { adminApi } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/feedback";
import type { AdBanner } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_OPTIONS = [
  { value: "SEARCH", label: "Search — open homes search" },
  { value: "LIST", label: "List property — owner flow" },
  { value: "URL", label: "External link" },
] as const;

/** Built-in brand images admins can pick from (plus any pasted URL). */
const IMAGE_CHOICES = [
  "/images/banner-own.jpg",
  "/images/banner-new.jpg",
  "/images/banner-direct.jpg",
  "/images/hero.jpg",
  "/images/prop-1.jpg",
  "/images/prop-2.jpg",
  "/images/prop-3.jpg",
  "/images/prop-4.jpg",
  "/images/prop-5.jpg",
  "/images/prop-6.jpg",
  "/images/prop-7.jpg",
  "/images/prop-8.jpg",
  "/images/prop-9.jpg",
];

type FormState = {
  kicker: string;
  title: string;
  body: string;
  ctaLabel: string;
  action: "SEARCH" | "LIST" | "URL";
  actionUrl: string;
  image: string;
  sortOrder: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  kicker: "",
  title: "",
  body: "",
  ctaLabel: "",
  action: "SEARCH",
  actionUrl: "",
  image: "",
  sortOrder: "0",
  active: true,
};

function toForm(ad: AdBanner): FormState {
  return {
    kicker: ad.kicker ?? "",
    title: ad.title ?? "",
    body: ad.body ?? "",
    ctaLabel: ad.ctaLabel ?? "",
    action: (["SEARCH", "LIST", "URL"] as const).includes(ad.action)
      ? ad.action
      : "SEARCH",
    actionUrl: ad.actionUrl ?? "",
    image: ad.image ?? "",
    sortOrder: String(ad.sortOrder ?? 0),
    active: ad.active ?? true,
  };
}

// ─── Create / edit dialog ────────────────────────────────────────

function AdFormDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: AdBanner | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial ? toForm(initial) : EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.title.trim()) {
      toastError(new Error("Title is required"), "Missing details");
      return;
    }
    if (!form.image.trim()) {
      toastError(new Error("Banner image is required"), "Missing details");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        kicker: form.kicker.trim(),
        title: form.title.trim(),
        body: form.body.trim(),
        ctaLabel: form.ctaLabel.trim() || "Learn more",
        action: form.action,
        actionUrl: form.actionUrl.trim(),
        image: form.image.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        active: form.active,
      };
      if (initial) {
        await adminApi.updateAd(initial.id, payload);
        toastSuccess("Banner updated", "The home carousel reflects it instantly.");
      } else {
        await adminApi.createAd(payload);
        toastSuccess("Banner created", "It is now live on the home carousel.");
      }
      onSaved();
    } catch (e) {
      toastError(e, "Could not save banner");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit banner" : "New carousel banner"}</DialogTitle>
        <DialogDescription>
          Banners show on the home page carousel, ordered by sort order.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ad-kicker">Kicker (small chip)</Label>
            <Input
              id="ad-kicker"
              value={form.kicker}
              onChange={(e) => set({ kicker: e.target.value })}
              placeholder="e.g. For homeowners"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ad-title"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g. Own a home in Ukhrul?"
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ad-body">Body text</Label>
          <Textarea
            id="ad-body"
            value={form.body}
            onChange={(e) => set({ body: e.target.value })}
            placeholder="Short supporting line shown under the title"
            className="min-h-20 rounded-xl"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ad-cta">Button label</Label>
            <Input
              id="ad-cta"
              value={form.ctaLabel}
              onChange={(e) => set({ ctaLabel: e.target.value })}
              placeholder="e.g. List your property"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-action">Button action</Label>
            <Select
              value={form.action}
              onValueChange={(v) => set({ action: v as FormState["action"] })}
            >
              <SelectTrigger id="ad-action" className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.action === "URL" && (
          <div className="space-y-1.5">
            <Label htmlFor="ad-url">
              Link URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ad-url"
              value={form.actionUrl}
              onChange={(e) => set({ actionUrl: e.target.value })}
              placeholder="https://example.com"
              inputMode="url"
              className="h-11 rounded-xl"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="ad-image">
            Banner image <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ad-image"
            value={form.image}
            onChange={(e) => set({ image: e.target.value })}
            placeholder="/images/banner-own.jpg or https://…"
            className="h-11 rounded-xl"
          />
          <UploadButton
            label="Upload banner image"
            className="rounded-full"
            onUploaded={(url) => set({ image: url })}
 />
          <div className="flex gap-2 overflow-x-auto pb-1 thin-scrollbar">
            {IMAGE_CHOICES.map((src) => (
              <button
                key={src}
                type="button"
                aria-label={`Use image ${src}`}
                aria-pressed={form.image === src}
                onClick={() => set({ image: src })}
                className={cn(
                  "relative size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all hover:-translate-y-0.5",
                  form.image === src
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-transparent"
                )}
              >
                <Photo src={src} alt="" className="h-full w-full" iconClassName="size-5" />
              </button>
            ))}
          </div>
          {form.image ? (
            <div className="overflow-hidden rounded-xl border">
              <Photo src={form.image} alt="Banner preview" className="h-28 w-full" />
            </div>
          ) : null}
        </div>

        <div className="flex items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ad-order">Sort order</Label>
            <Input
              id="ad-order"
              type="number"
              inputMode="numeric"
              value={form.sortOrder}
              onChange={(e) => set({ sortOrder: e.target.value })}
              className="h-11 w-24 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2 pb-2.5">
            <Switch
              id="ad-active"
              checked={form.active}
              onCheckedChange={(v) => set({ active: v })}
            />
            <Label htmlFor="ad-active" className="text-sm">
              Active (visible on home)
            </Label>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} className="rounded-full">
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={busy} className="rounded-full px-6">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {initial ? "Save changes" : "Create banner"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────

export function AdsTab() {
  const [ads, setAds] = useState<AdBanner[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formAd, setFormAd] = useState<AdBanner | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteAd, setDeleteAd] = useState<AdBanner | null>(null);

  const load = useCallback(() => {
    setError(null);
    adminApi
      .getAds()
      .then(setAds)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load banners"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (ad: AdBanner, active: boolean) => {
    setBusyId(ad.id);
    try {
      await adminApi.updateAd(ad.id, { active });
      setAds((list) => (list ? list.map((x) => (x.id === ad.id ? { ...x, active } : x)) : list));
      toastSuccess(active ? "Banner shown" : "Banner hidden", `“${ad.title}” saved.`);
    } catch (e) {
      toastError(e, "Could not update banner");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (ad: AdBanner) => {
    setBusyId(ad.id);
    try {
      await adminApi.deleteAd(ad.id);
      setAds((list) => (list ? list.filter((x) => x.id !== ad.id) : list));
      setDeleteAd(null);
      toastSuccess("Banner deleted", `“${ad.title}” removed from the carousel.`);
    } catch (e) {
      toastError(e, "Could not delete banner");
    } finally {
      setBusyId(null);
    }
  };

  if (error) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load banners"
        description={error}
        actionLabel="Retry"
        onAction={load}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Ads on the home carousel — create, reorder, hide or remove.
        </p>
        <Button
          onClick={() => {
            setFormAd(null);
            setFormOpen(true);
          }}
          className="min-h-11 shrink-0 rounded-full px-5"
        >
          <Plus aria-hidden />
          Add banner
        </Button>
      </div>

      {ads === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : ads.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No banners yet"
          description="Create the first carousel banner for the home page."
          actionLabel="Add banner"
          onAction={() => {
            setFormAd(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <ul className="max-h-[32rem] space-y-2 overflow-y-auto thin-scrollbar pr-1">
          {ads.map((ad) => (
            <li
              key={ad.id}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Photo
                  src={ad.image}
                  alt=""
                  className="h-16 w-24 shrink-0 rounded-xl"
                  iconClassName="size-5"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {ad.title}
                    {!ad.active ? (
                      <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Hidden
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ad.kicker ? `${ad.kicker} · ` : ""}
                    {ad.ctaLabel} · order {ad.sortOrder} ·{" "}
                    {ad.action === "URL" ? ad.actionUrl : ad.action}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 pr-1">
                  <Switch
                    checked={Boolean(ad.active)}
                    disabled={busyId === ad.id}
                    onCheckedChange={(v) => void toggleActive(ad, v)}
                    aria-label={`Show ${ad.title} on carousel`}
                  />
                  <span className="text-xs text-muted-foreground">Live</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === ad.id}
                  onClick={() => {
                    setFormAd(ad);
                    setFormOpen(true);
                  }}
                  className="min-h-9 rounded-full"
                >
                  <Pencil aria-hidden /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === ad.id}
                  onClick={() => setDeleteAd(ad)}
                  className="min-h-9 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 aria-hidden /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen ? (
        <Dialog open onOpenChange={(open) => !open && setFormOpen(false)}>
          <AdFormDialog
            initial={formAd}
            onClose={() => setFormOpen(false)}
            onSaved={() => {
              setFormOpen(false);
              load();
            }}
          />
        </Dialog>
      ) : null}

      <Dialog open={Boolean(deleteAd)} onOpenChange={(open) => !open && setDeleteAd(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this banner?</DialogTitle>
            <DialogDescription>
              “{deleteAd?.title}” will be removed from the home carousel immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteAd(null)}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busyId === deleteAd?.id}
              onClick={() => deleteAd && void remove(deleteAd)}
              className="rounded-full px-6"
            >
              {busyId === deleteAd?.id ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Trash2 aria-hidden />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
