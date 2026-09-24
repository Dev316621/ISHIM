"use client";

import { useState } from "react";
import { ImageIcon, Loader2, MapPin, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadButton } from "@/components/ishim/upload-button";
import { useStore } from "@/lib/store";
import { areasApi } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/feedback";

/**
 * WardManager — the simple "Areas & wards" editor for staff (admin + agent).
 * One list: every ward locals can pick when listing or browsing, each with
 * an optional photo that shows on the home page tiles. Add a name (photo
 * optional), change or remove a photo, remove a ward — each action saves
 * straight through PATCH /api/areas and refreshes the whole app live.
 */
export function WardManager() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [newName, setNewName] = useState("");
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const blocks = settings?.blocks ?? [];
  const wardImages = settings?.wardImages ?? {};

  const save = async (payload: { blocks?: string[]; wardImages?: Record<string, string> }, ok: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const fresh = await areasApi.save(payload);
      setSettings(fresh); // every selector — forms, browse tiles, filters — updates live
      toastSuccess(ok);
      return true;
    } catch (e) {
      toastError(e, "Could not save the areas");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addWard = async () => {
    const name = newName.trim().slice(0, 60);
    if (!name) return;
    if (blocks.some((b) => b.toLowerCase() === name.toLowerCase())) {
      toastError(new Error("That ward is already on the list"), "Duplicate ward");
      return;
    }
    const images = { ...wardImages };
    if (newPhoto) images[name] = newPhoto;
    const done = await save({ blocks: [...blocks, name], wardImages: images }, `“${name}” added to areas`);
    if (done) {
      setNewName("");
      setNewPhoto(null);
    }
  };

  const removeWard = async (name: string) => {
    const images = { ...wardImages };
    delete images[name];
    await save({ blocks: blocks.filter((b) => b !== name), wardImages: images }, `“${name}” removed`);
  };

  const setPhoto = async (name: string, url: string | null) => {
    const images = { ...wardImages };
    if (url) images[name] = url;
    else delete images[name];
    await save({ wardImages: images }, url ? `Photo updated for “${name}”` : `Photo removed from “${name}”`);
  };

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm" aria-label="Areas and wards">
      <header className="flex items-center gap-2">
        <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Areas &amp; wards</h3>
        {settings ? (
          <span className="ml-auto text-xs text-muted-foreground">{blocks.length} areas</span>
        ) : null}
      </header>
      <p className="mt-1 text-xs text-muted-foreground">
        The list locals pick when listing or browsing. Add a photo so each area shows itself
        on the home page tiles — areas without a photo keep a scenic default.
      </p>

      {/* Add a ward — name + optional photo */}
      <div className="mt-3 rounded-xl border bg-background/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addWard();
            }}
            placeholder="New ward name — e.g. Chadong"
            aria-label="New ward name"
            className="min-h-9 h-9 flex-1 rounded-full"
            maxLength={60}
            disabled={!settings || busy}
          />
          {newPhoto ? (
            <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
              <ImageIcon className="size-3.5" aria-hidden />
              Photo ready
              <button
                type="button"
                aria-label="Remove the chosen photo"
                className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                onClick={() => setNewPhoto(null)}
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ) : (
            <UploadButton label="Photo (optional)" onUploaded={(url) => setNewPhoto(url)} disabled={!settings || busy} />
          )}
          <Button
            size="sm"
            className="min-h-9 rounded-full"
            onClick={() => void addWard()}
            disabled={!settings || busy || !newName.trim()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            Add ward
          </Button>
        </div>
      </div>

      {/* The list */}
      {!settings ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No areas yet — add the first ward above.
        </p>
      ) : (
        <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-0.5 thin-scrollbar">
          {blocks.map((b) => (
            <li
              key={b}
              className="flex items-center gap-3 rounded-xl border bg-background/50 p-2.5"
            >
              {wardImages[b] ? (
                <img
                  src={wardImages[b]}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-black/5"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-primary"
                >
                  {b.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b}</p>
                <p className="text-xs text-muted-foreground">
                  {wardImages[b] ? "Has photo" : "No photo yet"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <UploadButton
                  label={wardImages[b] ? "Change" : "Photo"}
                  variant="secondary"
                  onUploaded={(url) => void setPhoto(b, url)}
                  disabled={busy}
                />
                {wardImages[b] ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-9 rounded-full px-2.5 text-muted-foreground"
                    aria-label={`Remove photo from ${b}`}
                    onClick={() => void setPhoto(b, null)}
                    disabled={busy}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-9 rounded-full px-2.5 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${b} from the area list`}
                  onClick={() => void removeWard(b)}
                  disabled={busy}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
