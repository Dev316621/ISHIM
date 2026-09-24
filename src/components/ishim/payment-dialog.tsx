"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeIndianRupee,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ownerApi, paymentsApi } from "@/lib/api";
import { toastError, toastSuccess, toastInfo } from "@/lib/feedback";
import { formatRent } from "@/lib/types";

/** Minimal typings for the Cashfree JS SDK (loaded lazily). */
interface CashfreeCheckoutResult {
  error?: { message?: string } | null;
  redirect?: boolean;
  paymentDetails?: unknown;
  paymentInitiated?: boolean;
}
interface CashfreeSdk {
  checkout: (opts: {
    paymentSessionId: string;
    redirectTarget?: string;
  }) => Promise<CashfreeCheckoutResult>;
}
declare global {
  interface Window {
    Cashfree?: new (cfg: { mode: "sandbox" | "production" }) => CashfreeSdk;
  }
}

const CF_SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";
const IS_DEV = process.env.NODE_ENV === "development";

function loadCashfreeSdk(): Promise<Window["Cashfree"]> {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve(window.Cashfree);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CF_SDK_URL}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (window.Cashfree) resolve(window.Cashfree);
      else reject(new Error("Cashfree SDK did not initialise"));
    };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Could not reach the payment service — check your connection")),
      { once: true }
    );
    if (!existing) {
      script.src = CF_SDK_URL;
      script.async = true;
      document.head.appendChild(script);
    } else if (window.Cashfree) {
      resolve(window.Cashfree);
    }
  });
}

export function PaymentDialog({
  open,
  onOpenChange,
  propertyId,
  propertyTitle,
  fee,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyTitle: string;
  fee: number;
  onPaid: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [polling, setPolling] = useState(false);
  const [unconfigured, setUnconfigured] = useState(false);
  const pollRef = useRef<number | null>(null);
  const orderIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  // Clear timers whenever the dialog closes.
  useEffect(() => {
    if (!open) {
      stopPolling();
      setBusy(false);
      setPaying(false);
    }
  }, [open, stopPolling]);
  useEffect(() => stopPolling, [stopPolling]);

  const finalizePaid = useCallback(() => {
    stopPolling();
    toastSuccess(
      "Payment received — thank you!",
      `${propertyTitle} is now closed as Rented.`
    );
    onPaid();
    onOpenChange(false);
  }, [onOpenChange, onPaid, propertyTitle, stopPolling]);

  /** Poll our status endpoint until the gateway confirms PAID (idempotent). */
  const startPolling = useCallback(
    (orderId: string) => {
      stopPolling();
      setPolling(true);
      let tries = 0;
      pollRef.current = window.setInterval(async () => {
        tries += 1;
        if (tries > 48) {
          // ~2 minutes — stop silently; webhook/boot handler still close the loop.
          stopPolling();
          toastInfo(
            "Still confirming",
            "The payment is taking longer to confirm. We'll update the listing as soon as it clears."
          );
          return;
        }
        try {
          const res = await paymentsApi.status(orderId);
          if (res.status === "PAID") finalizePaid();
          else if (res.status === "EXPIRED" || res.status === "MISSING") {
            stopPolling();
            toastError(new Error("The payment order expired — please start again."));
          }
        } catch {
          // transient network hiccup — keep polling
        }
      }, 2500);
    },
    [finalizePaid, stopPolling]
  );

  const startCashfree = async () => {
    setBusy(true);
    try {
      const order = await paymentsApi.createOrder(propertyId);

      // Money had already arrived for a previous attempt (customer paid but
      // the modal closed early) — the server fulfilled it, we just confirm.
      if ("paid" in order && order.paid) {
        finalizePaid();
        return;
      }
      orderIdRef.current = order.orderId;

      const CashfreeCtor = await loadCashfreeSdk();
      if (!CashfreeCtor) throw new Error("Could not load the payment window");
      const cf = new CashfreeCtor({ mode: order.mode });
      setPaying(true);
      const result = await cf.checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: "_modal",
      });
      setPaying(false);

      if (result.error) {
        toastError(
          new Error(result.error.message || "Payment didn't go through"),
          "Payment not completed"
        );
        return; // dialog stays open — user can retry
      }
      // Modal flow can return success details or redirect back to the app;
      // in every case our status endpoint is the source of truth.
      startPolling(order.orderId);
    } catch (e) {
      setPaying(false);
      const msg = e instanceof Error ? e.message : "Could not start the payment";
      if (/CASHFREE_UNCONFIGURED|not configured/i.test(msg) || (e instanceof Error && "code" in e && (e as { code?: string }).code === "CASHFREE_UNCONFIGURED")) {
        setUnconfigured(true);
        toastInfo("Online payments are being set up", "The UPI gateway isn't connected yet — the iShim team can record this fee manually for now.");
      } else {
        toastError(e, "Payment could not start");
      }
    } finally {
      setBusy(false);
    }
  };

  const simulateSuccess = async () => {
    setBusy(true);
    try {
      await ownerApi.payFee(propertyId);
      finalizePaid();
    } catch (e) {
      toastError(e, "Payment could not be recorded");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BadgeIndianRupee className="size-5 text-primary" aria-hidden />
            Success fee
          </DialogTitle>
          <DialogDescription>
            {propertyTitle} was rented — pay the one-time success fee to close it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
            <span className="text-sm text-secondary-foreground">Amount due</span>
            <span className="text-xl font-semibold text-secondary-foreground">
              {formatRent(fee)}
            </span>
          </div>

          {!unconfigured ? (
            <>
              <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3">
                <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <p className="text-sm leading-relaxed text-foreground/80">
                  You&apos;ll pay securely with <strong>UPI</strong> — GPay, PhonePe,
                  Paytm or any UPI app. Cards also accepted.
                </p>
              </div>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                Paid once per successful rental, collected by Cashfree. No brokerage, ever.
              </p>
            </>
          ) : (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <MessageCircle className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              Online payments are coming very soon. Until then the iShim team can
              confirm your fee over WhatsApp or in person.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {!unconfigured ? (
            <Button
              onClick={startCashfree}
              disabled={busy || polling}
              className="h-11 w-full rounded-full text-base"
            >
              {busy || polling ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Smartphone className="size-4" aria-hidden />
              )}
              {polling ? "Waiting for confirmation…" : "Pay via UPI"}
            </Button>
          ) : null}

          {IS_DEV ? (
            <Button
              onClick={simulateSuccess}
              disabled={busy || polling}
              variant="outline"
              className="h-11 w-full rounded-full"
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Simulate payment (dev)
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
