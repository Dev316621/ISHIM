"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Loader2, MessageSquareText, UserRound } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { publicApi } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/feedback";
import type { EnquiryKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIME_SLOTS = ["10:00", "11:30", "13:00", "14:30", "16:00", "17:30"];

/**
 * Tracked enquiry dialog — "let the agent handle it" (GENERAL) or
 * inspection visit booking (VISIT with a requested date + slot).
 * Anonymous visitors may enquire with name + phone; signed-in users
 * are prefilled.
 */
export function EnquiryDialog({
  open,
  onOpenChange,
  propertyId,
  propertyTitle,
  propertyBlock,
  initialKind,
  hasAgent,
  route,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyId: string;
  propertyTitle: string;
  propertyBlock: string;
  initialKind: EnquiryKind;
  hasAgent: boolean;
  /** Client's choice of handler — "OWNER" | "AGENT". Undefined = auto (agent if listed). */
  route?: "OWNER" | "AGENT";
  onDone?: () => void;
}) {
  const user = useStore((s) => s.user);

  const [kind, setKind] = useState<EnquiryKind>(initialKind);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    setName(user?.name ?? "");
    setPhone(user?.whatsappNumber || user?.phone || "");
    setMessage("");
    setDate("");
    setSlot("");
  }, [open, initialKind, user]);

  const handlerLabel = route === "OWNER" ? "owner" : hasAgent ? "agent" : "owner";
  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const submit = async () => {
    if (!name.trim()) {
      toastError(new Error("Please tell us your name."));
      return;
    }
    if (phone.replace(/[^0-9]/g, "").length < 10) {
      toastError(new Error("Please enter a valid phone number."));
      return;
    }
    if (kind === "VISIT" && (!date || !slot)) {
      toastError(new Error("Pick a date and a time slot for the visit."));
      return;
    }
    setBusy(true);
    try {
      await publicApi.createEnquiry(propertyId, {
        kind,
        name: name.trim(),
        phone: phone.trim(),
        message:
          message.trim() ||
          (kind === "VISIT"
            ? `I would like to book an inspection visit for ${propertyTitle} in ${propertyBlock}.`
            : `Hi, I am interested in ${propertyTitle} in ${propertyBlock}. Please help me with the details.`),
        ...(kind === "VISIT" && date && slot ? { visitAt: `${date}T${slot}:00` } : {}),
        ...(route ? { route } : {}),
      });
      toastSuccess(
        kind === "VISIT" ? "Visit requested!" : "Enquiry sent!",
        kind === "VISIT"
          ? `The ${handlerLabel} will confirm your slot soon.`
          : `The ${handlerLabel} will get back to you on WhatsApp or a call.`
      );
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toastError(e, "Could not send your enquiry");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-md thin-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {kind === "VISIT" ? "Book an inspection visit" : "Enquire about this home"}
          </DialogTitle>
          <DialogDescription>
            {kind === "VISIT"
              ? `Pick a slot and the ${handlerLabel} will confirm your walkthrough.`
              : `Send your questions — the ${handlerLabel} handles everything and replies to you.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Kind switch */}
          <div className="grid grid-cols-2 gap-2 rounded-full bg-secondary p-1" role="tablist" aria-label="Enquiry type">
            <button
              type="button"
              role="tab"
              aria-selected={kind === "GENERAL"}
              onClick={() => setKind("GENERAL")}
              className={cn(
                "flex min-h-10 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                kind === "GENERAL"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-secondary-foreground hover:bg-accent"
              )}
            >
              <MessageSquareText className="size-4" aria-hidden />
              Ask a question
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === "VISIT"}
              onClick={() => setKind("VISIT")}
              className={cn(
                "flex min-h-10 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                kind === "VISIT"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-secondary-foreground hover:bg-accent"
              )}
            >
              <CalendarCheck className="size-4" aria-hidden />
              Book a visit
            </button>
          </div>

          {kind === "VISIT" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="eq-date">Visit date</Label>
                <Input
                  id="eq-date"
                  type="date"
                  min={minDate}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Time slot</Label>
                <Select value={slot || undefined} onValueChange={setSlot}>
                  <SelectTrigger aria-label="Time slot" className="h-11 rounded-xl">
                    <SelectValue placeholder="Pick a slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="eq-name">Your name *</Label>
              <Input
                id="eq-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ringson M."
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-phone">Phone / WhatsApp *</Label>
              <Input
                id="eq-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9856001104"
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eq-message">Message {kind === "GENERAL" ? "(optional)" : ""}</Label>
            <Textarea
              id="eq-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                kind === "VISIT"
                  ? "Anything the owner should know? (gate code, best time…)"
                  : "e.g. Is the deposit negotiable? When can I move in?"
              }
              className="rounded-xl"
            />
          </div>

          <p className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5 text-xs text-secondary-foreground">
            <UserRound className="size-3.5 shrink-0 text-primary" aria-hidden />
            Routed to the listing {handlerLabel} — they see it in their iShim inbox instantly.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="rounded-full px-6">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {kind === "VISIT" ? "Request visit" : "Send enquiry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
