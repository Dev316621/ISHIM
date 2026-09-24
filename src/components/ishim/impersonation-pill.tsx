"use client";

import { useState } from "react";
import { Eye, Loader2, LogOut } from "lucide-react";
import { useStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { setSessionToken } from "@/lib/session";
import { toastError, toastSuccess } from "@/lib/feedback";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Fixed pill shown while an admin is impersonating another user.
 * Exit restores the admin session using the token kept in sessionStorage.
 */
export function ImpersonationPill() {
  const impersonation = useStore((s) => s.impersonation);
  const setImpersonation = useStore((s) => s.setImpersonation);
  const setUser = useStore((s) => s.setUser);
  const setView = useStore((s) => s.setView);
  const [busy, setBusy] = useState(false);

  if (!impersonation) return null;

  const exit = async () => {
    setBusy(true);
    try {
      const res = await authApi.restore(impersonation.token);
      setSessionToken(res.token ?? null);
      window.sessionStorage.removeItem("ishim_admin_token");
      setImpersonation(null);
      setUser(res.user);
      setView("profile");
      toastSuccess(`Welcome back, ${res.user.name}`, "Admin session restored.");
    } catch (e) {
      toastError(e, "Could not restore admin session");
      // Hard fallback: cookie still points at the impersonated user,
      // reloading lets /api/auth/me resolve a clean state.
      window.setTimeout(() => window.location.reload(), 800);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-3 z-50 md:bottom-6 md:right-6"
      >
        <div className="flex items-center gap-1 rounded-full bg-primary py-1.5 pl-3.5 pr-1.5 text-primary-foreground shadow-lg">
          <Eye className="size-4" aria-hidden />
          <span className="max-w-[9rem] truncate text-sm font-medium">
            Viewing as {impersonation.adminName}
          </span>
          <button
            type="button"
            onClick={exit}
            disabled={busy}
            className="ml-1 flex size-9 items-center justify-center rounded-full bg-primary-foreground/15 transition-colors hover:bg-primary-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
            aria-label="Exit impersonation"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <LogOut className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
