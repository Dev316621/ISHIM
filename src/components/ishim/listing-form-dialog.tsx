"use client";

import { useEffect, useState } from "react";
import {
  Check,
  HandCoins,
  House as HouseIcon,
  Loader2,
  Plus,
  Store as StoreIcon,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Photo } from "./photo";
import { UploadButton } from "./upload-button";
import { AskAgentDialog } from "./ask-agent-dialog";
import { useStore } from "@/lib/store";
import { ownerApi, type ListingPayload } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/feedback";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  clientFeeFor,
  HOUSE_TYPE_LABELS,
  KITCHEN_LABELS,
  moveInFeeFor,
  formatRent,
  type ListingMode,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STOCK_PHOTOS = Array.from({ length: 9 }, (_, i) => `/images/prop-${i + 1}.jpg`);

const blank: ListingPayload = {
  title: "",
  description: "",
  block: "",
  mode: "HOME",
  houseType: "",
  rent: 0,
  deposit: 0,
  bedrooms: 1,
  bathrooms: 1,
  amenities: [],
  photos: [],
  negotiable: false,
  kitchen: "",
  areaSqft: undefined,
  widthFt: undefined,
};

export function ListingFormDialog() {
  const open = useStore((s) => s.listingOpen);
  const editing = useStore((s) => s.listingEdit);
  const closeListing = useStore((s) => s.closeListing);
  const settings = useStore((s) => s.settings);
  const user = useStore((s) => s.user);
  const bumpListings = useStore((s) => s.bumpListings);
  const setView = useStore((s) => s.setView);

  const isAgent = user?.role === "AGENT";
  const storeMode = useStore((s) => s.mode);
  const [form, setForm] = useState<ListingPayload>({ ...blank });
  const [ownerPhone, setOwnerPhone] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [pickOtherBlock, setPickOtherBlock] = useState(false); // "My area is not listed" typed flow
  const [busy, setBusy] = useState(false);
  const [askAgentOpen, setAskAgentOpen] = useState(false);

  const blocks = settings?.blocks ?? [];
  // Typed-area mode when chosen explicitly, or when editing a listing whose
  // block isn't on the official list anymore (so the value stays editable).
  const otherBlock = pickOtherBlock || (!!form.block && !blocks.includes(form.block));

  const mode: ListingMode = form.mode;
  const business = mode === "BUSINESS";
  const typeOptions = business ? BUSINESS_TYPES : (settings?.houseTypes ?? ["ASSAM_TYPE", "RCC", "KUTCHA", "APARTMENT"]);

  const setMode = (m: ListingMode) =>
    setForm((f) => ({ ...f, mode: m, houseType: "" }));

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title,
        description: editing.description ?? "",
        block: editing.block,
        mode: editing.mode === "BUSINESS" ? "BUSINESS" : "HOME",
        houseType: editing.houseType,
        rent: editing.rent,
        deposit: editing.deposit,
        bedrooms: editing.bedrooms,
        bathrooms: editing.bathrooms,
        amenities: editing.amenities ?? [],
        photos: editing.photos ?? [],
        negotiable: editing.negotiable ?? false,
        kitchen: editing.kitchen ?? "",
        areaSqft: editing.areaSqft ?? undefined,
        widthFt: editing.widthFt ?? undefined,
      });
      setOwnerPhone(editing.owner?.phone ?? "");
    } else {
      setForm({ ...blank, mode: storeMode });
      setOwnerPhone("");
    }
    setManualUrl("");
    setPickOtherBlock(false);
  }, [open, editing, storeMode]);

  const set = <K extends keyof ListingPayload>(k: K, v: ListingPayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleAmenity = (a: string) =>
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter((x) => x !== a)
        : [...f.amenities, a],
    }));

  const togglePhoto = (p: string) =>
    setForm((f) => ({
      ...f,
      photos: f.photos.includes(p)
        ? f.photos.filter((x) => x !== p)
        : [...f.photos, p],
    }));

  const addManual = () => {
    const url = manualUrl.trim();
    if (!url) return;
    if (!form.photos.includes(url)) set("photos", [...form.photos, url]);
    setManualUrl("");
  };

  const submit = async () => {
    if (!form.title.trim() || !form.block || !form.houseType || form.rent <= 0) {
      toastError(
        new Error(
          business
            ? "Title, block, space type and a rent above ₹0 are required."
            : "Title, block, house type and a rent above ₹0 are required."
        )
      );
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await ownerApi.updateProperty(editing.id, {
          ...form,
          mode: undefined, // vertical can't change on edit
          ownerPhone: undefined, // owner link can't be changed via edit
        });
        toastSuccess("Listing updated");
      } else {
        await ownerApi.createProperty({
          ...form,
          // Residential-only fields never reach business listings.
          bedrooms: business ? 0 : form.bedrooms,
          bathrooms: business ? 0 : form.bathrooms,
          kitchen: business ? undefined : form.kitchen || undefined,
          ownerPhone: isAgent && ownerPhone.trim() ? ownerPhone.trim() : undefined,
        });
        toastSuccess(
          business ? "Business listing submitted" : "Listing submitted",
          "It will go live as soon as the iShim team approves it."
        );
      }
      bumpListings();
      closeListing();
      if (!editing) setView("profile");
    } catch (e) {
      toastError(e, editing ? "Could not update listing" : "Could not create listing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? closeListing() : null)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-2xl thin-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {editing ? "Edit listing" : business ? "Add a business listing" : "Add a listing"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the details — changes keep the current approval status."
              : settings?.phase === "STANDARD"
                ? `Listings go live after a quick review by the iShim team. Listing costs ${formatRent(clientFeeFor(settings, mode))} per listing.`
                : `Listings go live after a quick review by the iShim team. Free to list — ${formatRent(moveInFeeFor(settings, mode))} only when rented.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vertical — Homes vs Business. Fixed once created. */}
          <div className="space-y-2">
            <Label>What are you listing?</Label>
            <div
              role="radiogroup"
              aria-label="Listing type"
              className="grid grid-cols-2 gap-1 rounded-2xl border bg-secondary/50 p-1"
            >
              {([
                { key: "HOME" as ListingMode, label: "Home", sub: "House or apartment", icon: HouseIcon },
                { key: "BUSINESS" as ListingMode, label: "Business", sub: "Shop, office, cafe…", icon: StoreIcon },
              ]).map(({ key, label, sub, icon: Icon }) => {
                const active = mode === key;
                const disabled = !!editing;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={disabled}
                    onClick={() => setMode(key)}
                    className={cn(
                      "flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background hover:text-foreground",
                      disabled && "cursor-not-allowed opacity-70 hover:bg-transparent"
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="leading-tight text-left">
                      <span className="block font-semibold">{label}</span>
                      <span
                        className={cn(
                          "block text-[10px]",
                          active ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        {editing ? undefined : sub}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {editing ? (
              <p className="text-xs text-muted-foreground">
                A listing stays in its vertical — {business ? "business space" : "home"} (set when it was created).
              </p>
            ) : null}
          </div>
          {isAgent && !editing ? (
            <div className="space-y-2">
              <Label htmlFor="lf-owner-phone">
                Owner phone <span className="text-muted-foreground">(optional — bulk-list on their behalf)</span>
              </Label>
              <Input
                id="lf-owner-phone"
                type="tel"
                inputMode="numeric"
                placeholder="e.g. 9856001101"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="lf-title">Title *</Label>
            <Input
              id="lf-title"
              placeholder={
                business
                  ? "e.g. Road-facing shop room in Old Bazaar"
                  : "e.g. Sunny 2BHK Assam-type near Phungyo"
              }
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lf-desc">Description</Label>
            <Textarea
              id="lf-desc"
              rows={3}
              placeholder={
                business
                  ? "Footfall, road width, power/water, previous business…"
                  : "Water timing, view, distance to market…"
              }
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lf-block">Block *</Label>
              {otherBlock ? (
                <div className="space-y-1.5">
                  <Input
                    id="lf-block"
                    value={form.block}
                    onChange={(e) => set("block", e.target.value)}
                    placeholder="Type the area / ward name"
                    className="h-11 rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Not on the official list yet — the area is queued so the team can add it to
                    every list and filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPickOtherBlock(false);
                      set("block", "");
                    }}
                    className="rounded text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Choose from the list
                  </button>
                </div>
              ) : (
                <Select
                  value={form.block || undefined}
                  onValueChange={(v) => {
                    if (v === "__other__") {
                      setPickOtherBlock(true);
                      set("block", "");
                    } else {
                      set("block", v);
                    }
                  }}
                >
                  <SelectTrigger aria-label="Block" className="h-11 rounded-xl">
                    <SelectValue placeholder="Select block" />
                  </SelectTrigger>
                  <SelectContent>
                    {blocks.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                    <SelectItem value="__other__">My area is not listed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>{business ? "Space type *" : "House type *"}</Label>
              <Select
                value={form.houseType || undefined}
                onValueChange={(v) => set("houseType", v)}
              >
                <SelectTrigger aria-label="Type" className="h-11 rounded-xl">
                  <SelectValue placeholder={business ? "Select space type" : "Select type"} />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {business
                        ? (BUSINESS_TYPE_LABELS[t] ?? t)
                        : (HOUSE_TYPE_LABELS[t] ?? t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lf-rent">Monthly rent (₹) *</Label>
              <Input
                id="lf-rent"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.rent || ""}
                onChange={(e) => set("rent", Number(e.target.value) || 0)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lf-deposit">Deposit (₹)</Label>
              <Input
                id="lf-deposit"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.deposit || ""}
                onChange={(e) => set("deposit", Number(e.target.value) || 0)}
                className="h-11 rounded-xl"
              />
            </div>
            {!business ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lf-beds">Bedrooms</Label>
                  <Input
                    id="lf-beds"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={form.bedrooms}
                    onChange={(e) => set("bedrooms", Number(e.target.value) || 1)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lf-baths">Bathrooms</Label>
                  <Input
                    id="lf-baths"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={form.bathrooms}
                    onChange={(e) => set("bathrooms", Number(e.target.value) || 1)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lf-kitchen">Kitchen</Label>
                  <Select
                    value={form.kitchen || undefined}
                    onValueChange={(v) => set("kitchen", v)}
                  >
                    <SelectTrigger aria-label="Kitchen" className="h-11 rounded-xl">
                      <SelectValue placeholder="Select (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(KITCHEN_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="lf-area">Size (sq ft)</Label>
              <Input
                id="lf-area"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="e.g. 900"
                value={form.areaSqft ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  set("areaSqft", Number.isFinite(n) && n > 0 ? n : undefined);
                }}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lf-width">Width (ft)</Label>
              <Input
                id="lf-width"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="e.g. 30"
                value={form.widthFt ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  set("widthFt", Number.isFinite(n) && n > 0 ? n : undefined);
                }}
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card px-4 py-3">
            <div className="flex items-start gap-3">
              <HandCoins className="mt-0.5 size-5 text-primary" aria-hidden />
              <div>
                <Label htmlFor="lf-negotiable" className="font-medium">
                  Rent negotiable
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show a “Negotiable” badge so tenants know the price is open to discussion.
                </p>
              </div>
            </div>
            <Switch
              id="lf-negotiable"
              checked={!!form.negotiable}
              onCheckedChange={(v) => set("negotiable", v)}
              aria-label="Rent negotiable"
            />
          </div>

          <div className="space-y-2">
            <Label>Amenities</Label>
            <div className="flex flex-wrap gap-2">
              {(settings?.amenities ?? []).map((a) => {
                const active = form.amenities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleAmenity(a)}
                    className={cn(
                      "flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-accent"
                    )}
                  >
                    {active ? <Check className="size-3.5" aria-hidden /> : null}
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Photos — tap to select</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {STOCK_PHOTOS.map((src) => {
                const active = form.photos.includes(src);
                return (
                  <button
                    key={src}
                    type="button"
                    aria-pressed={active}
                    aria-label={active ? `Remove photo ${src}` : `Add photo ${src}`}
                    onClick={() => togglePhoto(src)}
                    className={cn(
                      "relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-primary" : "border-transparent hover:border-border"
                    )}
                  >
                    <Photo src={src} alt="" className="h-full w-full" />
                    {active ? (
                      <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" aria-hidden />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="…or paste an image URL"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addManual();
                  }
                }}
                className="h-10 rounded-xl"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addManual}
                className="h-10 shrink-0 rounded-xl"
              >
                <Plus aria-hidden /> Add
              </Button>
              <UploadButton
                label="Upload"
                variant="secondary"
                className="h-10 shrink-0 rounded-xl"
                onUploaded={(url) => {
                  if (!form.photos.includes(url)) {
                    set("photos", [...form.photos, url]);
                  }
                }}
              />
            </div>
            {form.photos.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {form.photos.map((p, i) => (
                  <div
                    key={p}
                    className="relative size-20 overflow-hidden rounded-xl border bg-secondary"
                  >
                    <Photo src={p} alt={`Photo ${i + 1}`} className="h-full w-full" />
                    <button
                      type="button"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() =>
                        set(
                          "photos",
                          form.photos.filter((x) => x !== p)
                        )
                      }
                      className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-background/90 shadow-sm hover:bg-background"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {!isAgent ? (
          <p className="text-center text-sm text-muted-foreground">
            Can&apos;t fill this yourself?{" "}
            <button
              type="button"
              onClick={() => setAskAgentOpen(true)}
              className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Ask an agent to list &amp; maintain it for you →
            </button>
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={closeListing}
            disabled={busy}
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="rounded-full px-6">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {editing ? "Save changes" : "Submit listing"}
          </Button>
        </DialogFooter>

        {/* Layered helper dialog: owner hands the listing to an agent. */}
        <AskAgentDialog open={askAgentOpen} onOpenChange={setAskAgentOpen} />
      </DialogContent>
    </Dialog>
  );
}
