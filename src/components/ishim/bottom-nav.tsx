"use client";

import { House, LayoutGrid, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "home", labelKey: "nav.home", icon: House },
  { key: "search", labelKey: "nav.search", icon: Search },
  { key: "profile", labelKey: "nav.more", icon: LayoutGrid },
] as const;

export function BottomNav() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const t = useT();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-white/80 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-3">
        {TABS.map(({ key, labelKey, icon: Icon }) => {
          const active = view === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-16 min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className="size-6"
                aria-hidden
                strokeWidth={active ? 2.4 : 1.8}
                fill={active ? "currentColor" : "none"}
                fillOpacity={active ? 0.15 : 0}
              />
              {t(labelKey)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
