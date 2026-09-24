"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  House,
  Loader2,
  MessageCircle,
  Store,
  UserRoundCheck,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Photo } from "./photo";
import { UploadButton } from "./upload-button";
import { useStore } from "@/lib/store";
import { leadsApi } from "@/lib/api";
import { toastError } from "@/lib/feedback";
import { formatRent } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * QuickListDialog — the no-account path into iShim.
 * A local says what they have in 4 taps; an iShim agent claims the request
 * from the Intake tab and does everything else (photos, listing, tenants).
 * Deliberately account-free: only name + WhatsApp phone are required.
 */

/** iShim agent desk line (country code 91 + number) — WhatsApp fallback. */
const DESK_WA = "919000000001";

type Mode = "HOME" | "BUSINESS";

export function QuickListDialog() {
  const open = useStore((s) => s.quickListOpen);
  const close = useStore((s) => s.closeQuickList);
  const settings = useStore((s) => s.settings);
  const t = useT();

  const [mode, setMode] = useState<Mode>("HOME");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [block, setBlock] = useState("");
  const [customArea, setCustomArea] = useState(false); // "My area is not listed" typed flow
  const [customName, setCustomName] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [rent, setRent] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; phone: string } | null>(null);

  const blocks = useMemo(() => settings?.blocks ?? [], [settings]);

  // "My area is not listed" — typed flow. Forced when there are no blocks
  // configured at all (nothing to select from).
  const forceCustom = blocks.length === 0;
  const otherArea = customArea || forceCustom;
  const areaValue = otherArea ? customName.trim() : block;

  const reset = () => {
    setMode("HOME");
    setName("");
    setPhone("");
    setBlock("");
    setCustomArea(false);
    setCustomName("");
    setPhotos([]);
    setRent("");
    setDetails("");
    setDone(null);
  };

  const onOpenChange = (v: boolean) => {
    if (!v) {
      close();
      // Let the closing animation finish before clearing the form.
      window.setTimeout(() => {
        if (!useStore.getState().quickListOpen) reset();
      }, 250);
    }
  };

  const submit = async () => {
    if (busy) return;
    const phoneDigits = phone.replace(/[^0-9]/g, "");
    if (name.trim().length < 2) return toastError(null, "Tell us your name so the agent knows who to call");
    if (phoneDigits.length < 10) return toastError(null, "Enter a valid WhatsApp phone number");
    if (otherArea && customName.trim().length < 2) {
      return toastError(null, "Type your area or ward name so the agent knows where to come");
    }
    setBusy(true);
    try {
      const rentNum = rent.trim() ? Number(rent.replace(/[^0-9]/g, "")) : null;
      await leadsApi.submitQuick({
        name: name.trim(),
        phone: phoneDigits,
        mode,
        block: areaValue || undefined,
        rent: rentNum && rentNum > 0 ? rentNum : null,
        details: details.trim() || undefined,
        photos: photos.length ? photos : undefined,
      });
      setDone({ name: name.trim(), phone: phoneDigits });
    } catch (e) {
      toastError(e, "Could not send your request — check your internet and try again");
    } finally {
      setBusy(false);
    }
  };

  const waHandoff = done
    ? `https://wa.me/${DESK_WA}?text=${encodeURIComponent(
        `Hi iShim! I just sent a quick-list request.\n\nName: ${done.name}\nPhone: ${done.phone}\nI have: ${mode === "HOME" ? "a home" : "a shop/space"}${areaValue ? ` in ${areaValue}` : ""}${rent ? `\nExpected rent: ₹${rent}` : ""}\n\nPlease call me — an agent can handle the listing for me.`
      )}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        {done ? (
          /* ── Success ─────────────────────────────────────────── */
          <div className="py-2 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="size-9 text-primary" aria-hidden />
            </div>
            <DialogHeader className="mt-4 items-center space-y-2 text-center sm:text-center">
              <DialogTitle className="text-xl tracking-tight">
                Done, {done.name.split(" ")[0]}!
              </DialogTitle>
              <DialogDescription className="mx-auto max-w-[34ch] text-sm leading-relaxed">
                {photos.length ? (
                  <>
                    Your photos are attached to the request. An iShim agent will WhatsApp you on{" "}
                    <span className="font-medium text-foreground">+91 {done.phone.slice(-10)}</span>{" "}
                    very soon — they handle the rest.
                  </>
                ) : (
                  <>
                    An iShim agent will WhatsApp you on{" "}
                    <span className="font-medium text-foreground">+91 {done.phone.slice(-10)}</span>{" "}
                    very soon. They handle everything — photos, listing and finding tenants.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <p className="mx-auto mt-3 flex max-w-[38ch] items-center justify-center gap-1.5 rounded-2xl bg-secondary/70 px-3 py-2 text-xs text-muted-foreground">
              <UserRoundCheck className="size-4 shrink-0 text-primary" aria-hidden />
              No account needed. Nothing else for you to do.
            </p>
            <div className="mt-5 grid gap-2">
              <Button asChild className="h-12 rounded-full text-base">
                <a href={waHandoff} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden /> Continue on WhatsApp
                </a>
              </Button>
              <Button variant="ghost" className="min-h-11 rounded-full" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          /* ── Form ────────────────────────────────────────────── */
          <>
            <DialogHeader className="space-y-1.5 text-left sm:text-left">
              <DialogTitle className="text-xl tracking-tight">{t("quick.title")}</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {t("quick.subtitle")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* What do you have? */}
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="What do you have?">
                {(
                  [
                    { key: "HOME" as Mode, label: t("quick.radio.home"), icon: House },
                    { key: "BUSINESS" as Mode, label: t("quick.radio.business"), icon: Store },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={mode === opt.key}
                    onClick={() => setMode(opt.key)}
                    className={cn(
                      "flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      mode === opt.key
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/25"
                    )}
                  >
                    <opt.icon className={cn("size-5", mode === opt.key && "text-primary")} aria-hidden />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ql-name">{t("quick.name")}</Label>
                  <Input
                    id="ql-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Athuan"
                    className="h-11 rounded-xl"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ql-phone">{t("quick.phone")}</Label>
                  <Input
                    id="ql-phone"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9856001234"
                    className="h-11 rounded-xl"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ql-area">{t("quick.area")}</Label>
                  {otherArea ? (
                    <div className="space-y-1.5">
                      <Input
                        id="ql-area"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder={t("quick.area.type")}
                        className="h-11 rounded-xl"
                        aria-label={t("quick.area.type")}
                      />
                      <p className="text-xs text-muted-foreground">{t("quick.area.note")}</p>
                      {!forceCustom ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomArea(false);
                            setCustomName("");
                          }}
                          className="rounded text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {t("quick.area.back")}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <Select
                      value={block || undefined}
                      onValueChange={(v) => {
                        if (v === "__other__") {
                          setCustomArea(true);
                          setBlock("");
                        } else {
                          setCustomArea(false);
                          setBlock(v);
                        }
                      }}
                    >
                      <SelectTrigger aria-label="Area" className="h-11 rounded-xl">
                        <SelectValue placeholder="Select area" />
                      </SelectTrigger>
                      <SelectContent>
                        {blocks.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                        <SelectItem value="__other__">{t("quick.area.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ql-rent">{t("quick.rent")}</Label>
                  <Input
                    id="ql-rent"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={rent}
                    onChange={(e) => setRent(e.target.value)}
                    placeholder="e.g. 8000"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ql-details">{t("quick.details")}</Label>
                <Textarea
                  id="ql-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="e.g. 2 rooms, ground floor, water connection, near the church…"
                  className="min-h-[4.5rem] rounded-xl"
                  rows={3}
                />
              </div>

              {/* Optional photos — helps the agent verify and list faster */}
              <div className="space-y-2">
                <Label>{t("quick.photos")}</Label>
                <p className="text-xs text-muted-foreground">{t("quick.photos.hint")}</p>
                {photos.length ? (
                  <div className="flex flex-wrap gap-2">
                    {photos.map((p, i) => (
                      <div key={p} className="relative size-20 overflow-hidden rounded-xl border bg-secondary">
                        <Photo src={p} alt={`Photo ${i + 1}`} className="h-full w-full" />
                        <button
                          type="button"
                          aria-label={`Remove photo ${i + 1}`}
                          onClick={() => setPhotos((ps) => ps.filter((x) => x !== p))}
                          className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-background/90 shadow-sm hover:bg-background"
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {photos.length < 3 ? (
                  <UploadButton
                    label={photos.length ? "Add another" : "Upload photo"}
                    variant="outline"
                    className="rounded-full"
                    disabled={busy}
                    onUploaded={(url) =>
                      setPhotos((ps) => (ps.includes(url) || ps.length >= 3 ? ps : [...ps, url]))
                    }
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">3 photos attached — that&apos;s plenty for now.</p>
                )}
              </div>

              <Button
                type="button"
                onClick={submit}
                disabled={busy}
                className="h-12 w-full rounded-full text-base"
              >
                {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                {busy ? t("quick.sending") : t("quick.submit")}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {t("quick.footnote")}
                {rent && Number(rent.replace(/[^0-9]/g, "")) > 0
                  ? ` · Around ${formatRent(Number(rent.replace(/[^0-9]/g, "")))}/mo`
                  : ""}
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
