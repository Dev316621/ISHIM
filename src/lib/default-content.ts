// ─── iShim CMS content: types, built-in defaults, validation ──────
// Shared by the help widget (rendering), the admin Content tab
// (editing) and the content API routes (validation). Pure data — no
// React / server imports so it can be used on both sides.

export type HelpArticleKey =
  | "how"
  | "about"
  | "contact"
  | "support"
  | "privacy"
  | "terms"
  | "policy"
  | "business";

export const CONTENT_KEYS: HelpArticleKey[] = [
  "how",
  "about",
  "contact",
  "support",
  "privacy",
  "terms",
  "policy",
  "business",
];

export function isHelpArticleKey(v: unknown): v is HelpArticleKey {
  return typeof v === "string" && (CONTENT_KEYS as string[]).includes(v);
}

// ─── Per-slug data shapes ─────────────────────────────────────────

export type StepRow = { title: string; body: string };
export type HowData = { steps: StepRow[]; note: string };

export type AboutData = { lead: string; bullets: string[]; outro: string };

export type ContactRow = { label: string; sub: string };
export type ContactData = {
  lead: string;
  whatsapp: { label: string; sub: string; number: string }; // number = international digits for wa.me
  email: { label: string; sub: string; address: string };
  location: ContactRow;
  hours: ContactRow;
};

export type FaqRow = { q: string; a: string };
export type FaqData = { faqs: FaqRow[] };

export type SectionRow = { h: string; p: string };
export type SectionsData = { sections: SectionRow[] };

export type ContentData =
  | HowData
  | AboutData
  | ContactData
  | FaqData
  | SectionsData;

export type ContentPageDto = {
  slug: HelpArticleKey;
  title: string;
  banner: string; // "" = none
  data: ContentData;
  customized: boolean;
  visible: boolean; // admin on/off toggle — hidden pages leave the public menu
  updatedAt: string | null;
  updatedBy: string;
};

// ─── Built-in defaults (mirrors the original in-app copy) ─────────

export const DEFAULT_CONTENT: Record<
  HelpArticleKey,
  { title: string; data: ContentData }
> = {
  how: {
    title: "How iShim works",
    data: {
      steps: [
        {
          title: "Search",
          body: "Browse verified homes by community block, price and type.",
        },
        {
          title: "WhatsApp the owner",
          body: "One tap opens a chat with the owner or listing agent. No middlemen.",
        },
        {
          title: "Move in",
          body: "Visit, agree, and collect your keys. We handle the rest.",
        },
      ],
      note: "Free for 36 months • ₹499 only on move-in. No brokerage — you pay only when your home is rented.",
    } satisfies HowData,
  },
  about: {
    title: "About iShim",
    data: {
      lead: "iShim is Ukhrul's own home-rental marketplace. We list real homes, in real neighbourhoods, across the community blocks of Ukhrul town — so finding a place no longer means word-of-mouth only.",
      bullets: [
        "Every listing is reviewed by the iShim team before it goes live.",
        "Chat directly with owners or listing agents on WhatsApp — no middlemen, no brokerage calls.",
        "Free for the first 36 months. Renters browse free and listing is free. A flat ₹499 success fee is charged only when a rental is finalised.",
      ],
      outro: "Made with care in Ukhrul, Manipur — by people who grew up here, for the people who live here.",
    } satisfies AboutData,
  },
  contact: {
    title: "Contact",
    data: {
      lead: "Questions about a listing, listing your home, or anything else? We are one message away.",
      whatsapp: {
        label: "WhatsApp",
        sub: "+91 90000 00001 · fastest reply",
        number: "919000000001",
      },
      email: { label: "Email", sub: "hello@ishim.in", address: "hello@ishim.in" },
      location: { label: "Ukhrul, Manipur", sub: "India 795142" },
      hours: { label: "Mon – Sat", sub: "9:00 – 18:00 IST" },
    } satisfies ContactData,
  },
  support: {
    title: "Support",
    data: {
      faqs: [
        {
          q: "Is iShim free to use?",
          a: "Everything is free for the first 36 months — browsing, listing and agent help. We charge a flat ₹499 success fee only when a rental is finalised through iShim — no brokerage, ever.",
        },
        {
          q: "How do I list my home?",
          a: "No account needed. Tap “List your Property”, fill the tiny form (name, WhatsApp number, area) and an iShim agent calls you back, takes photos and publishes the listing for you. You can also WhatsApp us directly.",
        },
        {
          q: "Do I need to create an account?",
          a: "No. iShim works without sign-up — browse freely, save favourites right on your phone and contact anyone directly. Only iShim agents and admin sign in (with Google).",
        },
        {
          q: "How do I know listings are genuine?",
          a: "Every listing is reviewed by the iShim team before it goes live, and owners are verified by phone. If something feels off, report it and we will check within a day.",
        },
        {
          q: "I am an agent. Can I list homes?",
          a: "Yes. Choose “Agent” when listing and your name appears as the contact. The same no-brokerage promise applies — tenants contact you directly on WhatsApp.",
        },
        {
          q: "What if the deal falls through?",
          a: "If the owner cancels before the agreement is signed, the ₹499 success fee is refunded in full. See Listing & refund policy for details.",
        },
      ],
    } satisfies FaqData,
  },
  privacy: {
    title: "Privacy",
    data: {
      sections: [
        {
          h: "What we collect",
          p: "Your name, phone number and WhatsApp number — only what is needed to connect renters and owners. Saved homes and recently contacted listings stay on your device.",
        },
        {
          h: "How it is used",
          p: "To show your listings, let renters contact you on WhatsApp, and keep iShim safe. We never sell your data or send spam.",
        },
        {
          h: "WhatsApp deep links",
          p: "Contact buttons open a chat directly with the owner or agent. The conversation happens on WhatsApp, under their own privacy terms.",
        },
        {
          h: "Your control",
          p: "You can delete any listing at any time. To remove your account and data, WhatsApp or email us and we will take it down within 48 hours.",
        },
      ],
    } satisfies SectionsData,
  },
  terms: {
    title: "Terms & Conditions",
    data: {
      sections: [
        {
          h: "Using iShim",
          p: "iShim is a platform that connects renters with owners and verified agents in Ukhrul. You must be 18+ to list a home. Information you provide must be accurate and your own.",
        },
        {
          h: "Listings",
          p: "Every listing is reviewed and may be edited, paused or removed if it breaks our rules or misleads renters. Repeat violations lead to account removal.",
        },
        {
          h: "Rentals",
          p: "iShim is not a party to the rental agreement. Rent, deposit, maintenance and house rules are agreed strictly between owner and tenant.",
        },
        {
          h: "Success fee",
          p: "A flat success fee — ₹499 during the free trial — is charged when a home shown on iShim is rented. There is no brokerage at any stage.",
        },
        {
          h: "Fair use",
          p: "No scraping, duplicate listings, fake enquiries or harassment of owners and tenants. Accounts breaking these terms may be suspended without notice.",
        },
      ],
    } satisfies SectionsData,
  },
  policy: {
    title: "Listing & refund policy",
    data: {
      sections: [
        {
          h: "Listing rules",
          p: "One genuine home per listing, with honest photos, rent and availability. Listings are reviewed by the iShim team before going live and may be re-checked at any time.",
        },
        {
          h: "Success fee",
          p: "₹499 during the free trial. The fee is charged once, only after a tenant confirms the home through iShim. It covers verification, coordination and support — it is not brokerage.",
        },
        {
          h: "Refunds",
          p: "Full refund if the owner cancels before the agreement is signed, if the home was already rented out, or if the listing was found to be misrepresented. Write to us within 7 days and refunds are processed within 5 working days.",
        },
        {
          h: "Reporting a problem",
          p: "Report any listing or user from the listing page, or reach us on WhatsApp. We respond within one working day.",
        },
      ],
    } satisfies SectionsData,
  },
  business: {
    title: "Business",
    data: {
      sections: [
        {
          h: "iShim by eX Holdings",
          p: "iShim is built and operated by eX Holdings — the company behind the platform's technology, verification and support. The business side handles partnerships, payments and compliance so the app stays simple for everyone.",
        },
        {
          h: "For owners with many homes",
          p: "Managing more than one property? The same free listing tools apply at any scale. Verified agents can list on your behalf and route enquiries to you on WhatsApp.",
        },
        {
          h: "For agents",
          p: "Agents get a client pipeline, owner links and demand insights — free during the 36-month launch. The flat success fee (₹499 during the free trial) applies per rented home, with no brokerage at any stage.",
        },
        {
          h: "Partner with eX Holdings",
          p: "Housing societies, ward members and local businesses can partner with us on verified listings and community drives. Reach us on WhatsApp to talk.",
        },
      ],
    } satisfies SectionsData,
  },
};

// ─── Validation ───────────────────────────────────────────────────

const s = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export function validateContentData(
  key: HelpArticleKey,
  data: unknown
): string | null {
  if (typeof data !== "object" || data === null)
    return "Content must be an object";
  const d = data as Record<string, unknown>;

  const rows = (
    arr: unknown,
    n: number,
    build: (r: Record<string, unknown>) => Record<string, unknown>
  ): Record<string, unknown>[] | string => {
    if (!Array.isArray(arr) || arr.length === 0) return "Add at least one row";
    if (arr.length > n) return `Too many rows (max ${n})`;
    return arr.map((r) =>
      build(typeof r === "object" && r !== null ? (r as Record<string, unknown>) : {})
    );
  };

  switch (key) {
    case "how": {
      const steps = rows(d.steps, 8, (r) => ({
        title: s(r.title, 120),
        body: s(r.body, 500),
      }));
      if (typeof steps === "string") return steps;
      if (steps.some((x) => !x.title)) return "Every step needs a title";
      return null;
    }
    case "about": {
      if (!s(d.lead, 800)) return "Lead paragraph is required";
      if (!Array.isArray(d.bullets) || d.bullets.length > 8)
        return "Bullets must be a list of at most 8";
      return null;
    }
    case "contact": {
      const wa = (d.whatsapp ?? {}) as Record<string, unknown>;
      const em = (d.email ?? {}) as Record<string, unknown>;
      const number = s(wa.number, 20).replace(/[^0-9]/g, "");
      if (number.length < 10 || number.length > 15)
        return "WhatsApp number must be 10-15 digits (with country code)";
      if (!s(em.address, 200).includes("@")) return "Email address looks invalid";
      return null;
    }
    case "support": {
      const faqs = rows(d.faqs, 20, (r) => ({ q: s(r.q, 200), a: s(r.a, 2000) }));
      if (typeof faqs === "string") return faqs;
      if (faqs.some((x) => !x.q || !x.a))
        return "Every FAQ needs a question and an answer";
      return null;
    }
    case "privacy":
    case "terms":
    case "policy":
    case "business": {
      const sections = rows(d.sections, 30, (r) => ({
        h: s(r.h, 120),
        p: s(r.p, 2000),
      }));
      if (typeof sections === "string") return sections;
      if (sections.some((x) => !x.h || !x.p))
        return "Every section needs a heading and text";
      return null;
    }
  }
}

/** Normalized + validated payload for PUT — throws an Error with a user message. */
export function buildContentPayload(
  key: HelpArticleKey,
  body: Record<string, unknown>
): { title: string; data: string; banner: string } {
  const title = s(body.title, 120) || DEFAULT_CONTENT[key].title;
  const err = validateContentData(key, body.data);
  if (err) throw new Error(err);
  const rawBanner = s(body.banner, 500);
  const banner =
    rawBanner && /^(https?:\/\/|\/)/.test(rawBanner) ? rawBanner : "";
  return { title, data: JSON.stringify(body.data), banner };
}
