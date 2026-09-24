"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Briefcase, Loader2, MapPin, MessageCircle, Phone } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { publicApi } from "@/lib/api";
import { formatPhoneDisplay, formatRent, normalizePhoneE164, type DirectoryProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Fallback when no agent profiles are reachable: the iShim agent desk line. */
const DESK_PHONE = "919000000001";

function ContactButtons({
  phone,
  waMessage,
  ariaName,
  desk = false,
  className,
}: {
  phone: string;
  waMessage: string;
  ariaName: string;
  desk?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex shrink-0 items-center gap-2", className)}>
      <Button
        asChild
        size="sm"
        variant="outline"
        className="h-9 rounded-full px-3.5"
      >
        <a href={`tel:+${normalizePhoneE164(phone)}`} aria-label={`Call ${ariaName}`}>
          <Phone aria-hidden />
          Call
        </a>
      </Button>
      <Button
        asChild
        size="sm"
        variant={desk ? "secondary" : "default"}
        className="h-9 rounded-full px-3.5"
      >
        <a
          href={`https://wa.me/${normalizePhoneE164(phone)}?text=${encodeURIComponent(waMessage)}`}
          target="_blank"
          rel="noopener,noreferrer"
          aria-label={`WhatsApp ${ariaName}`}
        >
          <MessageCircle aria-hidden />
          WhatsApp
        </a>
      </Button>
    </span>
  );
}

/**
 * "Ask an agent to list for you" — for owners who can't (or don't want to)
 * fill the listing form themselves. Shows every registered agent with one-tap
 * Call / WhatsApp (prefilled hand-over message); the agent then lists the home
 * on the owner's behalf and maintains it (Task 21/23 agent tooling already
 * lets linked agents edit listings, handle enquiries and mark them rented).
 */
export function AskAgentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const user = useStore((s) => s.user);
  const settings = useStore((s) => s.settings);

  const [agents, setAgents] = useState<DirectoryProfile[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await publicApi.getDirectory();
      setAgents(d.profiles.filter((p) => p.role === "AGENT"));
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const handOver = (agent: DirectoryProfile) =>
    user
      ? `Hi ${agent.name}, I'm ${user.name} (${user.phone}). I'd like to list my home on iShim but can't do it online — please list it for me and maintain it. Thank you!`
      : `Hi ${agent.name}, I'd like help listing my home on iShim — please list and maintain it for me.`;

  const deskMessage = user
    ? `Hi iShim, I'm ${user.name} (${user.phone}). I'd like an agent to list my home for me — please connect me.`
    : "Hi iShim, I'd like an agent to list my home for me — please connect me.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl thin-scrollbar sm:max-w-md [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="text-xl">Ask an agent to list for you</DialogTitle>
          <DialogDescription>
            No internet skills or no time? An iShim agent will take the details
            and photos over a call or visit, list your home, and keep it
            maintained — updates, enquiries, marking it rented — while
            it&apos;s live.{" "}
            {settings?.phase === "STANDARD"
              ? settings.agentHelpFee > 0
                ? `Agent help costs ${formatRent(settings.agentHelpFee)} — set by the iShim team.`
                : "Agent help is free — set by the iShim team."
              : "Free during the 36-month launch — only the move-in fee when it rents."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2" aria-live="polite">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Finding agents…
            </div>
          ) : agents && agents.length > 0 ? (
            agents.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-2xl border bg-card p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    {a.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w.charAt(0).toUpperCase())
                      .join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{a.name}</span>
                      {a.verified ? (
                        <>
                          <BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden />
                          <span className="sr-only">Verified</span>
                        </>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Briefcase className="size-3 shrink-0" aria-hidden />
                      Agent · {a.stats.available} available
                      {a.blocks.length ? (
                        <span className="flex min-w-0 items-center gap-1">
                          ·
                          <MapPin className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{a.blocks[0]}</span>
                          {a.blocks.length > 1 ? ` +${a.blocks.length - 1}` : ""}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </div>
                <ContactButtons
                  phone={a.whatsapp ?? a.phone}
                  waMessage={handOver(a)}
                  ariaName={a.name}
                  
                />
              </div>
            ))
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary"
                >
                  <Phone className="size-5 text-primary" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">iShim Agent Desk</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {formatPhoneDisplay(DESK_PHONE)} · we&apos;ll connect you
                  </span>
                </span>
              </div>
              <ContactButtons
                phone={DESK_PHONE}
                waMessage={deskMessage}
                ariaName="iShim Agent Desk"
                desk
                
              />
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Agents are verified members of the iShim network — they confirm with you
          before anything goes live. You can also call the desk directly:{" "}
          <span className="font-medium tabular-nums">
            {formatPhoneDisplay(DESK_PHONE)}
          </span>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
