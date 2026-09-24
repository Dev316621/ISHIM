"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { moveInApi } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/feedback";

/**
 * "Mark move-in" — lets an ADMIN or AGENT record that a tenant successfully
 * moved into a home. The stay (Tenancy, STAYING) then shows in the owner's
 * dashboard under "Successful move-ins". The tenant is created on the spot
 * when the phone number is new to iShim.
 */
export function MoveInDialog({
  open,
  onOpenChange,
  property,
  onMarked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  property: { id: string; title: string } | null;
  onMarked?: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone("");
      setName("");
    }
  }, [open]);

  const submit = async () => {
    if (!property) return;
    const digits = phone.replace(/[^0-9]/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      toastError(new Error("Enter a valid 10-digit tenant phone number."));
      return;
    }
    setBusy(true);
    try {
      const res = await moveInApi.mark({
        propertyId: property.id,
        tenantPhone: digits,
        tenantName: name.trim() || undefined,
      });
      toastSuccess(
        "Move-in marked 🎉",
        `${res.tenant.name} is recorded as moved into “${res.property.title}” — it now shows on the owner's dashboard.`
      );
      onOpenChange(false);
      onMarked?.();
    } catch (e) {
      toastError(e, "Could not mark the move-in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl thin-scrollbar sm:max-w-md [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <KeyRound className="size-5 text-primary" aria-hidden />
            Mark move-in
          </DialogTitle>
          <DialogDescription>
            {property ? (
              <>
                Record the successful move-in for{" "}
                <span className="font-medium text-foreground">
                  “{property.title}”
                </span>
                . It will show in the owner&apos;s iShim dashboard right away.
              </>
            ) : (
              "Record the successful move-in."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mi-phone">Tenant phone *</Label>
            <Input
              id="mi-phone"
              type="tel"
              inputMode="numeric"
              placeholder="e.g. 9856123456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              New to iShim? We&apos;ll create their account automatically.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mi-name">
              Tenant name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="mi-name"
              placeholder="e.g. Grace Awungshi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <p className="rounded-2xl bg-secondary/60 px-4 py-3 text-xs text-muted-foreground">
            This only records the stay. To take the listing off the market use
            “Mark as rented” — the success-fee flow stays with the owner
            (amount set by iShim for the listing&apos;s vertical).
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
          <Button onClick={() => void submit()} disabled={busy} className="rounded-full px-6">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
            Mark move-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
