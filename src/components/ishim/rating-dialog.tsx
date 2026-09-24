"use client";

import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/feedback";
import type { RatingTarget } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Star-rating dialog for a home (PROPERTY) or its agent (AGENT).
 * One rating per user per target — submitting again updates it.
 */
export function RatingDialog({
  open,
  onOpenChange,
  propertyId,
  target,
  agentName,
  initialRating,
  initialComment,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyId: string;
  target: RatingTarget;
  agentName?: string;
  initialRating?: number | null;
  initialComment?: string | null;
  onSaved?: () => void;
}) {
  const [stars, setStars] = useState(initialRating ?? 0);
  const [comment, setComment] = useState(initialComment ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStars(initialRating ?? 0);
    setComment(initialComment ?? "");
  }, [open, initialRating, initialComment]);

  const title = target === "AGENT" ? `Rate ${agentName || "the agent"}` : "Rate this home";

  const submit = async () => {
    if (!stars) {
      toastError(new Error("Tap the stars to pick a rating."));
      return;
    }
    setBusy(true);
    try {
      await clientApi.rateProperty(propertyId, {
        targetType: target,
        rating: stars,
        comment: comment.trim() || undefined,
      });
      toastSuccess("Thank you!", "Your rating helps other renters in Ukhrul.");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toastError(e, "Could not save your rating");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>
            {target === "AGENT"
              ? "How was the agent's service — replies, visits, follow-ups?"
              : "Share how the home is — water, light, space, neighbourhood."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-center gap-1.5" role="radiogroup" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onClick={() => setStars(n)}
                className="rounded-full p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Star
                  className={cn(
                    "size-9 transition-colors",
                    n <= stars ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/30"
                  )}
                  aria-hidden
                />
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rd-comment">Comment (optional)</Label>
            <Textarea
              id="rd-comment"
              rows={3}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="A few words for the next renter…"
              className="rounded-xl"
            />
          </div>
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
          <Button onClick={submit} disabled={busy || !stars} className="rounded-full px-6">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {initialRating ? "Update rating" : "Submit rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
