"use client";

import { useStore } from "@/lib/store";

/**
 * Shared "List your Property" action (NavBar + ads carousel CTA).
 *
 * Research with locals in Ukhrul: most people do NOT want an account —
 * they just want to hand the details to an agent (ideally on WhatsApp)
 * and have the agent do everything. So the easy path is the no-account
 * QuickListDialog:
 *
 *   guest / client / admin  →  quick list (agent handles the rest)
 *   OWNER / AGENT           →  full listing form (self-serve path)
 */
export function useListProperty() {
  const user = useStore((s) => s.user);

  return () => {
    if (user && (user.role === "OWNER" || user.role === "AGENT")) {
      useStore.getState().openListing();
      return;
    }
    useStore.getState().openQuickList();
  };
}
