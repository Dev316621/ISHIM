// ─── WhatsApp follow-up templates for staff (agent & admin) ──────────
// Every outbound staff→local WhatsApp gets a ready, warm, prefilled
// message so agents never stare at a blank chat. Templates are plain
// functions of a small context object, so they stay testable and easy
// to extend.

export interface LeadWaCtx {
  name: string; // person who sent the listing request
  mode: "HOME" | "BUSINESS";
  block?: string | null;
  rent?: number | null;
  agentName: string;
}

export interface EnquiryWaCtx {
  name: string; // person who enquired
  propertyTitle: string;
  block?: string | null;
  agentName: string;
  kind: "GENERAL" | "VISIT";
}

export interface WaTemplate<C> {
  key: string;
  label: string;
  build: (ctx: C) => string;
}

/** wa.me link with a prefilled message — phone digits only, assumes India. */
export function waHref(phone: string, text: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  const e164 = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${e164}?text=${encodeURIComponent(text)}`;
}

const place = (mode: LeadWaCtx["mode"]) => (mode === "BUSINESS" ? "shop/space" : "home");
const at = (block?: string | null) => (block ? ` in ${block}` : "");

// ── Listing requests (quick form leads) ─────────────────────────────

export const LEAD_TEMPLATES: WaTemplate<LeadWaCtx>[] = [
  {
    key: "hello",
    label: "First hello",
    build: (c) =>
      `Hi ${c.name}, this is ${c.agentName} from iShim. You asked us to list your ${place(c.mode)}${at(c.block)} — when is a good time to talk?`,
  },
  {
    key: "photos",
    label: "Photo visit",
    build: (c) =>
      `Hi ${c.name}, ${c.agentName} from iShim here. Could we stop by your ${place(c.mode)}${at(c.block)} this week to take a few photos for the listing? A 10-minute visit is enough — just reply with a day and time that suits you.`,
  },
  {
    key: "live",
    label: "Now live",
    build: (c) =>
      `Good news ${c.name}! Your ${place(c.mode)}${at(c.block)} is now live on iShim. We'll reach out as soon as an interested family or tenant shows up. — ${c.agentName}, iShim`,
  },
  {
    key: "nudge",
    label: "Gentle nudge",
    build: (c) =>
      `Hi ${c.name}, ${c.agentName} from iShim here — just checking in. Still happy to help you list your ${place(c.mode)}${at(c.block)}? Reply here whenever it suits you.`,
  },
];

/** Sensible default template per lead status. */
export const LEAD_DEFAULT_KEY: Record<string, string> = {
  NEW: "hello",
  CLAIMED: "photos",
  LISTED: "live",
  DISCARDED: "nudge",
};

// ── Property enquiries (people asking about a listing) ──────────────

export const ENQUIRY_TEMPLATES: WaTemplate<EnquiryWaCtx>[] = [
  {
    key: "reply",
    label: "First reply",
    build: (c) =>
      `Hi ${c.name}, this is ${c.agentName} from iShim — you asked about "${c.propertyTitle}"${c.block ? ` in ${c.block}` : ""}. Happy to help! Would you like to visit it, or know more (rent, deposit, water supply)?`,
  },
  {
    key: "visit",
    label: "Fix a visit",
    build: (c) =>
      `Hi ${c.name}, ${c.agentName} from iShim here. When would suit for a visit to "${c.propertyTitle}"? We have slots today and tomorrow afternoon — just reply with a time and we'll keep it ready.`,
  },
  {
    key: "options",
    label: "More options",
    build: (c) =>
      `Hi ${c.name}, ${c.agentName} from iShim. Besides "${c.propertyTitle}", we have a few similar places you might like — want me to share them here?`,
  },
  {
    key: "followup",
    label: "Follow-up",
    build: (c) =>
      `Hi ${c.name}, did you get a chance to think about "${c.propertyTitle}"? Happy to answer any questions or arrange another visit. — ${c.agentName}, iShim`,
  },
];

/** Default template per enquiry kind. */
export const ENQUIRY_DEFAULT_KEY: Record<string, string> = {
  GENERAL: "reply",
  VISIT: "visit",
};

/** Render a template set into plain {key,label,text} rows for the dialog. */
export function renderTemplates<C>(
  templates: WaTemplate<C>[],
  ctx: C
): { key: string; label: string; text: string }[] {
  return templates.map((t) => ({ key: t.key, label: t.label, text: t.build(ctx) }));
}
