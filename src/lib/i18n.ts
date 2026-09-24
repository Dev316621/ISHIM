"use client";

// ─── iShim language layer (English / Tangkhul / Meiteilon) ──────────
// A tiny dictionary over the app's core guest-facing strings. English is
// the built-in baseline; Tangkhul and Meiteilon start EMPTY and are filled
// by the iShim admin in Admin → Settings → "App language" (stored in the
// Settings table as langOverrides, applied live). Any string without a
// translation simply stays English — the app is never half-broken.

import { useStore } from "./store";

export type Lang = "EN" | "TK" | "MN";

export const LANGS: { key: Lang; label: string; note: string }[] = [
  { key: "EN", label: "English", note: "Default" },
  { key: "TK", label: "Tangkhul", note: "Being added" },
  { key: "MN", label: "Meiteilon", note: "Being added" },
];

/** Per-language overrides stored in Settings: key → translated text. */
export type LangOverrides = Record<string, Partial<Record<Exclude<Lang, "EN">, string>>>;

/**
 * The core catalog — every string the language layer covers, with its
 * English baseline. {param} placeholders are replaced by t(key, params).
 */
export const CORE_STRINGS = {
  // nav
  "nav.home": "Home",
  "nav.search": "Search",
  "nav.more": "More",
  // hero (home)
  "hero.title.homes": "Where in Ukhrul?",
  "hero.title.business": "Rent it for your business",
  "hero.sub.homes": "Homes, shops, owners & more — search everything in Ukhrul.",
  "hero.sub.business": "Shops, offices, cafes & more — for rent across Ukhrul.",
  // featured strip
  "featured.title.homes": "Featured homes",
  "featured.title.business": "Featured spaces",
  "featured.sub.homes": "Hand-picked across Ukhrul's blocks.",
  "featured.sub.business": "Hand-picked shops, offices & cafes across Ukhrul.",
  "featured.seeAll": "See all",
  "featured.empty.homes": "No featured homes yet — check back soon.",
  "featured.empty.business": "No featured business spaces yet — check back soon.",
  // blocks
  "blocks.title": "Browse by block",
  "blocks.sub.homes": "Find your neighborhood in Ukhrul.",
  "blocks.sub.business": "Find the right neighborhood for your business.",
  "blocks.viewAll": "View all",
  "blocks.empty": "No community blocks yet — they're added by the iShim team.",
  // vertical switch
  "vert.homes.brand": "Homes",
  "vert.homes.sub": "Houses & apartments",
  "vert.business.brand": "Business",
  "vert.business.sub": "Shops, offices, cafes",
  // footer
  "footer.tagline.homes": "Find your home in Ukhrul.",
  "footer.tagline.business": "Find a shop, office or cafe in Ukhrul.",
  "footer.browsing": "You are browsing",
  "footer.pricing": "Pricing",
  "footer.owners": "Know your Owners",
  // property card
  "card.featured": "Featured",
  "card.rented": "Rented",
  "card.available": "Available",
  "card.negotiable": "Negotiable",
  "card.mode.home": "Home",
  "card.mode.business": "Business",
  "card.rentedNote": "Currently rented out — open it to ask when it's free again.",
  "card.save": "Save home",
  "card.unsave": "Remove from saved",
  // detail view
  "detail.whatsapp": "WhatsApp",
  "detail.call": "Call",
  "detail.share": "Share",
  "detail.bookVisit": "Book a visit",
  "detail.saveHome": "Save home",
  "detail.saved": "Saved",
  "detail.availableNow": "Available now",
  "detail.currentlyRented": "Currently rented",
  "detail.deposit": "Deposit",
  "detail.negotiable": "Rent negotiable",
  "detail.fixed": "Fixed price",
  "detail.about.home": "About this home",
  "detail.about.space": "About this space",
  "detail.amenities": "Amenities",
  "detail.brokerageNote": "No brokerage. Listing fee only after you rent.",
  // quick list dialog
  "quick.title": "List it — we'll do the rest",
  "quick.subtitle":
    "No account, no forms to learn. Tell us what you have and an iShim agent calls you on WhatsApp, takes photos and lists it for you — free.",
  "quick.radio.home": "A home",
  "quick.radio.business": "Shop / office",
  "quick.name": "Your name *",
  "quick.phone": "WhatsApp number *",
  "quick.area": "Area / ward",
  "quick.rent": "Expected rent (₹/month)",
  "quick.details": "Anything else? (rooms, floor, water…)",
  "quick.submit": "Send to an iShim agent",
  "quick.sending": "Sending…",
  "quick.footnote": "Free to list · Zero brokerage · We only use your number to reach you",
  "quick.area.other": "My area is not listed",
  "quick.area.type": "Type your area / ward name",
  "quick.area.note": "Not on the map yet — an iShim agent will add it for you.",
  "quick.area.back": "Choose from the list",
  "quick.photos": "Photos (optional)",
  "quick.photos.hint": "Add up to 3 photos — the agent lists it faster with photos.",
  // more hub
  "more.welcome": "Welcome to iShim",
  "more.welcomeSub":
    "No account needed — you're already in. Save homes on this device, contact anyone directly, and let our agents do the paperwork.",
  "more.wishlist": "Wishlist",
  "more.wishlistSub": "Homes you heart live here",
  "more.list": "List a home or business",
  "more.listSub": "Contact an agent — they do everything",
  "more.find": "Find a home",
  "more.findSub": "Browse by area, rent & type",
  "more.pricing": "Pricing",
  "more.pricingSub": "Flat ₹499 during the free trial",
  "more.owners": "Know your Owners",
  "more.ownersSub": "Real people & their track record",
  "more.help": "Help & contact",
  "more.helpSub": "FAQs or WhatsApp the iShim desk",
  "more.history": "Contact history",
  "more.language": "App language",
  "more.languageSub": "Untranslated text stays in English.",
  // pricing view
  "pricing.hero": "One flat {fee}. That's it.",
  "pricing.heroSub":
    "During the free trial, every corner of iShim is free — browsing, listing, agent help — and the only charge is the one-time {fee} success fee when a rental actually closes. Same for homes and business spaces. No brokerage, ever.",
  "pricing.rightNow": "Right now",
  "pricing.afterTrial": "After the free trial",
  "pricing.free": "Free",
  "pricing.tba": "To be announced",
} as const;

export type CoreKey = keyof typeof CORE_STRINGS;

/** Every catalog key — used by the admin translation editor. */
export const CORE_KEYS = Object.keys(CORE_STRINGS) as CoreKey[];

/**
 * Resolve a string for the active language:
 * admin override (TK/MN) → English baseline. Unknown keys return the key
 * itself so missing wiring is visible instead of crashing.
 */
export function translate(
  key: CoreKey | (string & {}),
  lang: Lang,
  overrides: LangOverrides | undefined | null,
  params?: Record<string, string | number>
): string {
  let text: string =
    lang !== "EN" ? (overrides?.[key]?.[lang] ?? CORE_STRINGS[key as CoreKey] ?? key) : (CORE_STRINGS[key as CoreKey] ?? key);
  if (params) {
    for (const [p, v] of Object.entries(params)) {
      text = text.replaceAll(`{${p}}`, String(v));
    }
  }
  return text;
}

/** Hook: `const t = useT(); t("nav.home")` — reactive to lang + settings. */
export function useT() {
  const lang = useStore((s) => s.lang);
  const overrides = useStore((s) => s.settings?.langOverrides);
  return (key: CoreKey | (string & {}), params?: Record<string, string | number>) =>
    translate(key, lang, overrides, params);
}

/** How many catalog strings a language covers (for the admin editor). */
export function coverage(lang: Exclude<Lang, "EN">, overrides: LangOverrides | undefined | null): number {
  return CORE_KEYS.filter((k) => (overrides?.[k]?.[lang] ?? "").trim().length > 0).length;
}
