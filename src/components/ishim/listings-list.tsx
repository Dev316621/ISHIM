"use client";

import { Eye, IndianRupee, MessageCircle, Pencil, RefreshCcw, Home, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Photo } from "./photo";
import { StatusBadge } from "./status-badge";
import { useStore } from "@/lib/store";
import { ownerApi } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/feedback";
import {
  FEE_DUE_WINDOW_DAYS,
  formatDate,
  formatRent,
  moveInFeeFor,
  getFeeDueInfo,
  typeLabel,
  type Property,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";

/**
 * Shared listing rows for Owner dashboard and Agent "Listings" tab.
 * `onEdit` opens the edit dialog; rented/relist/pay-fee actions call the API directly.
 */
export function ListingsList({
  properties,
  onEdit,
}: {
  properties: Property[];
  onEdit: (p: Property) => void;
}) {
  const bumpListings = useStore((s) => s.bumpListings);
  const settings = useStore((s) => s.settings);
  const mode = useStore((s) => s.mode);
  const business = mode === "BUSINESS";

  const markRented = async (p: Property) => {
    try {
      const res = await ownerApi.markRented(p.id);
      bumpListings();
      if (res.feeWaived || res.feePaid) {
        toastSuccess(
          "Marked as rented",
          res.feeWaived
            ? "The success fee was waived by iShim — nothing to pay."
            : "The success fee for this home was already paid."
        );
        return;
      }
      // Open payment dialog via store flag handled by the parent dashboard
      useStore.getState().setPaymentDialog({ propertyId: p.id, title: p.title, fee: res.fee });
      toastSuccess("Marked as rented", "Complete the success fee to close the listing.");
    } catch (e) {
      toastError(e, "Could not mark as rented");
    }
  };

  /** Re-opens the payment dialog for a fee-due listing ("pay later" entry). */
  const payFee = async (p: Property) => {
    try {
      const res = await ownerApi.markRented(p.id);
      if (res.feeWaived || res.feePaid) {
        bumpListings();
        toastSuccess("Nothing to pay", "The success fee was already settled.");
        return;
      }
      useStore.getState().setPaymentDialog({ propertyId: p.id, title: p.title, fee: res.fee });
    } catch (e) {
      toastError(e, "Could not open the payment dialog");
    }
  };

  const relist = async (p: Property) => {
    try {
      await ownerApi.relist(p.id);
      bumpListings();
      toastSuccess("Listing re-listed", "It will go live again after review.");
    } catch (e) {
      toastError(e, "Could not re-list this home");
    }
  };

  if (!properties.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-muted/40 px-6 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
          <Home className="size-6 text-primary/60" aria-hidden />
        </div>
        <p className="font-medium">No {business ? "business listings" : "homes"} yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add your first {business ? "shop, office or cafe" : "home"} — it takes
          about a minute and is free to list.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {properties.map((p) => {
        const feeInfo = getFeeDueInfo(p);
        return (
          <li
            key={p.id}
            className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center"
          >
            <Photo
              src={p.photos?.[0]}
              alt={p.title}
              className="h-28 w-full shrink-0 rounded-xl sm:h-20 sm:w-28"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">{p.title}</p>
                {p.mode === "BUSINESS" ? (
                  <Badge variant="outline" className="rounded-full border-primary/30 text-primary">
                    Business
                  </Badge>
                ) : null}
                <StatusBadge status={p.status} />
                {p.featured ? (
                  <Badge variant="outline" className="rounded-full border-primary/30 text-primary">
                    Featured
                  </Badge>
                ) : null}
                {feeInfo ? (
                  <Badge
                    className={
                      feeInfo.overdue
                        ? "rounded-full bg-red-100 text-red-800 border-red-200"
                        : "rounded-full bg-amber-100 text-amber-800 border-amber-200"
                    }
                  >
                    {feeInfo.overdue
                      ? `Fee overdue by ${feeInfo.daysOverdue}d`
                      : `Fee due in ${feeInfo.daysLeft}d`}
                  </Badge>
                ) : null}
                {p.feePaid ? (
                  <Badge variant="outline" className="rounded-full border-primary/30 text-primary">
                    Fee paid
                  </Badge>
                ) : null}
                {p.feeWaived ? (
                  <Badge variant="outline" className="rounded-full border-primary/30 text-primary">
                    Fee waived
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {p.block} · {typeLabel(p)} · {formatRent(p.rent)}/mo
              </p>
              {p.status === "REJECTED" && p.rejectionReason ? (
                <p className="mt-1 text-xs font-medium text-destructive">
                  Rejected: {p.rejectionReason}
                </p>
              ) : null}
              {feeInfo ? (
                <p
                  className={
                    feeInfo.overdue
                      ? "mt-1 flex items-start gap-1.5 text-xs font-medium text-red-700"
                      : "mt-1 flex items-start gap-1.5 text-xs text-amber-700"
                  }
                >
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {feeInfo.overdue
                    ? `${formatRent(moveInFeeFor(settings, p.mode === "BUSINESS" ? "BUSINESS" : "HOME"))} success fee is ${feeInfo.daysOverdue} ${feeInfo.daysOverdue === 1 ? "day" : "days"} overdue. Pay now — unpaid fees lead to account suspension.`
                    : `Success fee due by ${formatDate(feeInfo.dueDate.toISOString())} (${FEE_DUE_WINDOW_DAYS} days from marking rented).`}
                </p>
              ) : null}
              <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="size-3.5" aria-hidden /> {p.views ?? 0}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="size-3.5" aria-hidden /> {p.whatsappClicks ?? 0}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
              {p.status !== "RENTED" && p.status !== "REJECTED" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(p)}
                  className="min-h-9 rounded-full"
                >
                  <Pencil aria-hidden /> Edit
                </Button>
              ) : null}
              {(p.status === "ACTIVE" || p.status === "PENDING") && !p.rentedAt ? (
                <Button
                  size="sm"
                  onClick={() => void markRented(p)}
                  className="min-h-9 rounded-full"
                >
                  <IndianRupee aria-hidden /> Mark as Rented
                </Button>
              ) : null}
              {feeInfo ? (
                <Button
                  size="sm"
                  onClick={() => void payFee(p)}
                  className={
                    feeInfo.overdue
                      ? "min-h-9 rounded-full bg-red-600 hover:bg-red-700"
                      : "min-h-9 rounded-full"
                  }
                >
                  <IndianRupee aria-hidden /> Pay fee
                </Button>
              ) : null}
              {p.rentedAt || p.status === "RENTED" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void relist(p)}
                  className="min-h-9 rounded-full"
                >
                  <RefreshCcw aria-hidden /> Re-list
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
