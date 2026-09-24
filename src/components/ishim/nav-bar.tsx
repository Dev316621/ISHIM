"use client";

import { House, LayoutDashboard, LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useListProperty } from "./use-list-property";
import { OmniSearchTrigger } from "./omni-search";

function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/brand/logo.png"
      alt="iShim"
      className={`w-auto ${className ?? "h-8"}`}
    />
  );
}

export function NavBar() {
  const user = useStore((s) => s.user);
  const setView = useStore((s) => s.setView);
  const onListProperty = useListProperty();
  const view = useStore((s) => s.view);

  const dashboardLabel =
    user?.role === "OWNER"
      ? "Dashboard"
      : user?.role === "AGENT"
        ? "Agent"
        : user?.role === "ADMIN"
          ? "Admin"
          : "Profile";

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border/60 bg-background/75 backdrop-blur-xl md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setView("home")}
          aria-label="iShim home"
          className="flex items-center rounded-xl px-1 py-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
        </button>

        {/* Google-style universal search pill */}
        <div className="min-w-0 flex-1 max-w-md">
          <OmniSearchTrigger />
        </div>

        <nav aria-label="Primary" className="flex items-center gap-1.5">
          {user ? (
            <Button
              variant="ghost"
              onClick={() => setView("profile")}
              className={
                view === "profile" ? "bg-accent text-accent-foreground" : ""
              }
            >
              {user.role === "CLIENT" ? (
                <House aria-hidden />
              ) : (
                <LayoutDashboard aria-hidden />
              )}
              {dashboardLabel}
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setView("profile")}
              className={
                view === "profile" ? "bg-accent text-accent-foreground" : ""
              }
            >
              <LayoutGrid aria-hidden />
              More
            </Button>
          )}
          <Button
            onClick={onListProperty}
            className="rounded-full pl-3 pr-4"
            variant="secondary"
          >
            <Plus aria-hidden />
            List your Property
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function MobileTopBar() {
  const setView = useStore((s) => s.setView);
  const mode = useStore((s) => s.mode);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <button
          type="button"
          onClick={() => setView("home")}
          aria-label="iShim home"
          className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          <Logo className="h-7 w-auto" />
        </button>
        <span className="text-xs font-medium text-muted-foreground">
          {mode === "BUSINESS"
            ? "Shops, offices & cafes in Ukhrul"
            : "Find your home in Ukhrul"}
        </span>
      </div>
    </header>
  );
}
