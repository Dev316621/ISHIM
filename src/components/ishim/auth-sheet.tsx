"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { toastInfo } from "@/lib/feedback";

/** Official multicolour Google "G". */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

/**
 * Staff sign-in sheet. iShim is account-free for locals — tenants browse,
 * save homes on their device and reach agents without ever signing up, and
 * owners hand their home to an agent through the quick form. The ONLY
 * sign-in on iShim is Google, for the team (agents & admin); the admin
 * pre-adds each staff member's Google email from the admin panel.
 */
export function AuthSheet() {
  const authOpen = useStore((s) => s.authOpen);
  const closeAuth = useStore((s) => s.closeAuth);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authOpen) setBusy(false);
  }, [authOpen]);

  // After a Google redirect lands back on "/", surface an OAuth error
  // (e.g. a local account bounced by the staff-only gate) once.
  useEffect(() => {
    let alive = true;
    authApi
      .googlePending()
      .then((res) => {
        if (!alive) return;
        if (res.message) toastInfo("Google sign-in", res.message);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const startGoogle = async () => {
    setBusy(true);
    try {
      const { configured } = await authApi.googleStatus();
      if (!configured) {
        toastInfo(
          "Google sign-in isn't set up yet",
          "Ask the admin to add the Google credentials in the server settings."
        );
        return;
      }
      window.location.href = "/api/auth/google";
    } catch {
      toastInfo("Google sign-in isn't available right now");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={authOpen}
      onOpenChange={(open) => {
        if (!open) closeAuth();
      }}
    >
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <img
            src="/brand/icon-192.png"
            alt=""
            aria-hidden
            className="mx-auto mb-1 size-14 rounded-2xl shadow-sm"
          />
          <DialogTitle className="text-xl">iShim team sign-in</DialogTitle>
          <DialogDescription>
            For iShim agents &amp; admin only — sign in with your Google
            account (added by the admin).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Have a home or looking for one?</span>{" "}
          You don&apos;t need an account here — browse freely, save homes on
          this device, and reach any agent directly on WhatsApp or by call.
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void startGoogle()}
          className="h-11 w-full rounded-full border-border/80 bg-card text-base font-medium text-foreground hover:bg-muted/60"
        >
          <GoogleIcon className="size-5" />
          Continue with Google
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden />
          Everyone else — no account needed. Enjoy iShim!
        </p>
      </DialogContent>
    </Dialog>
  );
}
