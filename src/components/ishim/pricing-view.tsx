"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeIndianRupee,
  Check,
  Clock,
  Globe,
  Handshake,
  KeyRound,
  Percent,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./empty-state";
import { useStore } from "@/lib/store";
import { publicApi } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { formatRent, type AppSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

function longDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/** One "what it costs right now" tile. */
function NowTile({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: typeof Search;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border bg-card p-4 shadow-sm",
        highlight && "border-primary/30 bg-secondary/50"
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-secondary">
        <Icon className="size-4 text-primary" aria-hidden />
      </span>
      <p className="mt-3 truncate text-sm font-medium">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-xl font-semibold tracking-tight",
          highlight && "text-primary"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

/**
 * One after-the-free-trial charge card. When the admin hasn't set the
 * amount yet it shows "To be announced" instead of a number.
 */
function PlanCard({
  icon: Icon,
  kicker,
  amount,
  per,
  points,
  announced,
}: {
  icon: typeof Globe;
  kicker: string;
  amount: string; // "₹X" or "To be announced"
  per: string;
  points: string[];
  announced: boolean;
}) {
  const t = useT();
  return (
    <div className="flex min-w-0 flex-col rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Icon className="size-4 text-primary" aria-hidden />
        </span>
        <p className="text-sm font-semibold">{kicker}</p>
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-semibold tracking-tight",
          !announced && "text-muted-foreground"
        )}
      >
        {amount}
      </p>
      <p className="text-xs text-muted-foreground">{per}</p>
      <ul className="mt-3 space-y-1.5">
        {points.map((pt) => (
          <li
            key={pt}
            className="flex items-start gap-1.5 text-xs text-muted-foreground"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            {pt}
          </li>
        ))}
      </ul>
      <span className="mt-4 inline-flex w-fit rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        {announced ? "Set by the iShim team" : t("pricing.tba")}
      </span>
    </div>
  );
}

/**
 * /pricing — the iShim model in one line: during the free trial everything
 * is free except a FLAT ₹499 success fee when a rental closes (homes and
 * business alike — no client/owner split). After the trial: web listing
 * charge + agent help + commission — the iShim team adds the amounts and
 * details (admin panel) before it kicks in; until then it reads "to be
 * announced".
 */
export function PricingView() {
  const t = useT();
  const setView = useStore((s) => s.setView);
  const storeSettings = useStore((s) => s.settings);
  const [fresh, setFresh] = useState<AppSettings | null>(null);
  const [failed, setFailed] = useState(false);

  // Paint instantly from the store, then always re-fetch so a long-lived
  // session (or an admin fee change) never shows a stale phase.
  useEffect(() => {
    if (fresh || failed) return;
    let alive = true;
    publicApi
      .getSettings()
      .then((s) => {
        if (alive) setFresh(s);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [fresh, failed]);

  const s = fresh ?? storeSettings;
  const free = s?.phase === "FREE";

  const flatFee = s ? formatRent(s.successFee) : "₹499";

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView("home")}
          className="-ml-2 mb-3 gap-1.5 rounded-full text-muted-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"
          >
            <BadgeIndianRupee className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("pricing.hero", { fee: flatFee })}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {t("pricing.heroSub", { fee: flatFee })}
            </p>
          </div>
        </div>
      </div>

      {!s && !failed ? (
        <div className="space-y-4" aria-hidden>
          <Skeleton className="h-40 rounded-3xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
        </div>
      ) : !s ? (
        <EmptyState
          icon={BadgeIndianRupee}
          title="Couldn't load pricing"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => setFailed(false)}
          className="mt-5"
        />
      ) : (
        <>
          {/* Phase status card */}
          <section
            aria-live="polite"
            className={cn(
              "rounded-3xl border p-5 shadow-sm sm:p-6",
              free ? "border-primary/25 bg-secondary/60" : "bg-card"
            )}
          >
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                free
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {free ? <Sparkles className="size-3.5" aria-hidden /> : null}
              {free ? "Free trial active" : "Free trial ended"}
            </span>
            {free ? (
              <>
                <p className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                  Free until {longDate(s.freeUntil)}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="rounded-full bg-background px-2 py-0.5 font-medium tabular-nums">
                    {s.daysLeft.toLocaleString("en-IN")} days left
                  </span>
                  <span>
                    Trial started {longDate(s.freeModelStartAt)} — set by the
                    iShim team.
                  </span>
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  No accounts, no client or owner fees, no per-contact charges.
                  One flat {flatFee} — paid once, only when a rental closes.
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                  The free trial has ended
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Ended {longDate(s.freeUntil)} — the charges below now apply.
                </p>
              </>
            )}
          </section>

          {/* What it costs right now */}
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("pricing.rightNow")}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <NowTile
                icon={Search}
                label="Browse & search"
                value={t("pricing.free")}
                sub="Every listing, every filter"
              />
              <NowTile
                icon={Globe}
                label="List a home or business"
                value={t("pricing.free")}
                sub="An agent lists it for you"
              />
              <NowTile
                icon={Handshake}
                label="Agent help"
                value={t("pricing.free")}
                sub="Photos, listing, enquiries — done for you"
              />
              <NowTile
                icon={KeyRound}
                label="Success fee on move-in"
                value={flatFee}
                sub="Flat · one-time · only when rented"
                highlight
              />
            </div>
          </section>

          {/* After the free trial — web listing + agent help + commission */}
          <section className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("pricing.afterTrial")}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Clock className="size-3" aria-hidden /> From {longDate(s.freeUntil)}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              The iShim team will announce these amounts (with the full
              details) before the trial ends — they&apos;re set in the admin
              control centre and appear here the moment they&apos;re decided.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <PlanCard
                icon={Globe}
                kicker="Web listing charge"
                amount={s.webListingCharge > 0 ? formatRent(s.webListingCharge) : "To be announced"}
                per="per listing on iShim"
                points={[
                  "Your home or business space stays live",
                  "Photos, edits and availability included",
                ]}
                announced={s.webListingCharge > 0}
              />
              <PlanCard
                icon={Handshake}
                kicker="Agent help"
                amount={
                  s.agentHelpFee > 0 ? formatRent(s.agentHelpFee) : "To be announced"
                }
                per="full-service listing & upkeep"
                points={[
                  "They take the details, photos and list for you",
                  "Keep the listing maintained while it's live",
                ]}
                announced={s.agentHelpFee > 0}
              />
              <PlanCard
                icon={Percent}
                kicker="Commission"
                amount={s.commissionFee > 0 ? formatRent(s.commissionFee) : "To be announced"}
                per="on a successful rental"
                points={[
                  "Only when a deal actually closes",
                  "Never upfront, never per enquiry",
                ]}
                announced={s.commissionFee > 0}
              />
            </div>
            {s.postTrialNote ? (
              <p className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                {s.postTrialNote}
              </p>
            ) : null}
          </section>

          {/* Reassurance strip */}
          <p className="mt-6 flex items-start gap-2 rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            No brokerage, ever. Nothing is charged upfront — the flat {flatFee}{" "}
            success fee applies only when a listing is actually rented. Every
            amount on this page is controlled by the iShim team and applies
            platform-wide.
          </p>
        </>
      )}
    </div>
  );
}
