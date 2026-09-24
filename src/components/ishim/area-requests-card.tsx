"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, MapPin, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/lib/store";
import { areaApi, type AreaRequestItem } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/feedback";
import { formatDate } from "@/lib/types";

/**
 * AreaRequestsCard — the shared queue for "my area is not listed".
 * When a guest or owner types an area/ward that isn't on the official
 * list, the request lands here. Agents see it at the top of the intake
 * tab; admins in Settings. One tap on "Add" appends the area to the
 * platform's Settings blocks list (fresh settings are pushed into the
 * store, so every selector updates live) — or dismiss it.
 */
export function AreaRequestsCard() {
  const setSettings = useStore((s) => s.setSettings);
  const [rows, setRows] = useState<AreaRequestItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    areaApi
      .list("NEW")
      .then((d) => setRows(d.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load area requests"));
  }, []);

  useEffect(() => {
    // Off the effect body (react-hooks/set-state-in-effect): load clears
    // error state synchronously, so schedule it instead of calling directly.
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const act = async (id: string, action: "add" | "discard") => {
    if (busyId) return;
    setBusyId(id);
    try {
      const { request, settings } = await areaApi.act(id, action);
      if (settings) setSettings(settings); // selectors everywhere refresh instantly
      setRows((list) => (list ?? []).filter((r) => r.id !== id));
      toastSuccess(
        action === "add"
          ? `“${request.blockName ?? request.name}” added to areas`
          : "Request dismissed",
        action === "add"
          ? "It's now selectable in every listing form and browse filter."
          : undefined
      );
    } catch (e) {
      toastError(e, "Could not update the request");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm" aria-label="Area requests">
      <header className="flex items-center gap-2">
        <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Area requests</h3>
        {rows !== null && rows.length > 0 ? (
          <Badge className="rounded-full bg-destructive text-destructive-foreground">
            {rows.length}
          </Badge>
        ) : null}
        {rows !== null && rows.length > 0 ? (
          <span className="ml-auto text-xs text-muted-foreground">waiting to be added</span>
        ) : null}
      </header>

      {error ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-sm text-destructive">Couldn&apos;t load area requests — {error}</p>
          <Button variant="outline" size="sm" className="min-h-9 shrink-0 rounded-full" onClick={load}>
            Retry
          </Button>
        </div>
      ) : rows === null ? (
        <Skeleton className="mt-3 h-16 rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No pending requests. When someone listing a home or shop can&apos;t find their area and
          types it instead, it lands here.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border bg-background/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.mode === "BUSINESS" ? "For a shop / office" : "For a home"}
                    {r.requesterName ? ` · ${r.requesterName}` : ""}
                    {r.requesterPhone ? ` · ${r.requesterPhone}` : ""}
                    {" · "}
                    {formatDate(r.createdAt)}
                  </p>
                  {r.note ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">“{r.note}”</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    className="min-h-9 rounded-full"
                    onClick={() => void act(r.id, "add")}
                    disabled={busyId === r.id}
                  >
                    {busyId === r.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-4" aria-hidden />
                    )}
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-9 rounded-full text-muted-foreground"
                    aria-label={`Dismiss ${r.name}`}
                    onClick={() => void act(r.id, "discard")}
                    disabled={busyId === r.id}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rows !== null && rows.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Adding an area makes it selectable in every listing form and browse filter instantly.
        </p>
      ) : null}
    </section>
  );
}
