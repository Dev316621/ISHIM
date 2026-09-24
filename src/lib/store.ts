"use client";

import { create } from "zustand";
import type { Lang } from "./i18n";
import type {
  AppSettings,
  ListingMode,
  Property,
  RecentContact,
  SearchFiltersView,
  SearchScope,
  User,
} from "./types";

export type View = "home" | "search" | "detail" | "directory" | "pricing" | "profile";

/** Articles available inside the floating help widget. */
export type HelpArticle =
  | "how"
  | "about"
  | "contact"
  | "support"
  | "privacy"
  | "terms"
  | "policy"
  | "business";

export interface ISStore {
  // boot / session
  booted: boolean;
  user: User | null;
  settings: AppSettings | null;
  // navigation
  view: View;
  propertyId: string | null;
  /** Site vertical — HOME (residential) or BUSINESS (shops, offices, cafes…). */
  mode: ListingMode;
  /** App language for guest-facing strings (EN baseline; TK/MN via settings overrides). */
  lang: Lang;
  searchFilters: SearchFiltersView;
  // auth sheet (staff-only Google sign-in)
  authOpen: boolean;
  // saved homes
  savedIds: string[];
  // local contact history (device-side, contract has no contact-log read API)
  recentContacts: RecentContact[];
  // impersonation (admin god-mode)
  impersonation: { token: string; adminName: string } | null;
  // global listing dialog (nav / dashboards trigger)
  listingOpen: boolean;
  listingEdit: Property | null;
  // bumped after listing mutations so dashboards re-fetch
  listingsVersion: number;
  // global payment (success-fee) dialog
  paymentDialog: { propertyId: string; title: string; fee: number } | null;
  // floating help widget (draggable "?" button)
  helpOpen: boolean;
  helpArticle: HelpArticle | null;
  // universal (Google-style) search overlay — desktop nav pill / ⌘K / "/"
  omniOpen: boolean;
  // pre-filled name search for the "Know your Owners" directory view
  directoryQuery: string;

  setBooted: (v: boolean) => void;
  setUser: (u: User | null) => void;
  setSettings: (s: AppSettings | null) => void;
  setView: (v: View) => void;
  /** Switch the site vertical; clears vertical-specific filters and leaves detail views. */
  setMode: (m: ListingMode) => void;
  /** Switch the app language (persisted on the device). */
  setLang: (l: Lang) => void;
  openProperty: (id: string) => void;
  goSearch: (filters?: Partial<SearchFiltersView>) => void;
  openAuth: () => void;
  closeAuth: () => void;
  setSearchFilters: (f: Partial<SearchFiltersView>) => void;
  clearFilters: () => void;
  setSavedIds: (ids: string[]) => void;
  toggleSavedLocal: (id: string, saved: boolean) => void;
  addRecentContact: (c: RecentContact) => void;
  clearRecentContacts: () => void;
  setImpersonation: (i: { token: string; adminName: string } | null) => void;
  openListing: (edit?: Property | null) => void;
  closeListing: () => void;
  /** No-account quick-list intake dialog ("let an agent do it"). */
  quickListOpen: boolean;
  openQuickList: () => void;
  closeQuickList: () => void;
  bumpListings: () => void;
  setPaymentDialog: (
    p: { propertyId: string; title: string; fee: number } | null
  ) => void;
  openHelp: (article?: HelpArticle) => void;
  closeHelp: () => void;
  setHelpArticle: (a: HelpArticle | null) => void;
  setOmniOpen: (v: boolean) => void;
  setDirectoryQuery: (q: string) => void;
}

export const EMPTY_FILTERS: SearchFiltersView = {
  block: "",
  houseType: "",
  minRent: undefined,
  maxRent: undefined,
  bedrooms: undefined,
  q: "",
  scope: "" as SearchScope,
  near: false,
};

const RECENT_KEY = "ishim_recent_contacts";
const MODE_KEY = "ishim_mode";
const SAVED_KEY = "ishim_saved_homes";
const LANG_KEY = "ishim_lang";

function loadMode(): ListingMode {
  if (typeof window === "undefined") return "HOME";
  try {
    return window.localStorage.getItem(MODE_KEY) === "BUSINESS" ? "BUSINESS" : "HOME";
  } catch {
    return "HOME";
  }
}

function persistMode(m: ListingMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MODE_KEY, m);
  } catch {
    // storage unavailable
  }
}

function loadLang(): Lang {
  if (typeof window === "undefined") return "EN";
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return v === "TK" || v === "MN" ? v : "EN";
  } catch {
    return "EN";
  }
}

function persistLang(l: Lang) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANG_KEY, l);
  } catch {
    // storage unavailable
  }
}

function loadRecentContacts(): RecentContact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentContact[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistRecentContacts(list: RecentContact[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    // storage full / unavailable
  }
}

/**
 * Saved homes live on the DEVICE for locals — iShim is account-free, so
 * guests' hearts persist in localStorage (no sign-in, no sync needed).
 * Signed-in staff/legacy users additionally get server hydration, and
 * their toggles write-through here too.
 */
function loadSavedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function persistSavedIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(ids.slice(0, 100)));
  } catch {
    // storage full / unavailable
  }
}

export const useStore = create<ISStore>((set, get) => ({
  booted: false,
  user: null,
  settings: null,

  view: "home",
  propertyId: null,
  mode: "HOME",
  lang: "EN",
  searchFilters: { ...EMPTY_FILTERS },

  authOpen: false,

  savedIds: [],
  recentContacts: [],
  impersonation: null,
  listingOpen: false,
  listingEdit: null,
  listingsVersion: 0,
  paymentDialog: null,

  setBooted: (v) => set({ booted: v }),
  setUser: (u) => set({ user: u }),
  setSettings: (s) => set({ settings: s }),

  setView: (v) => set({ view: v, propertyId: v === "detail" ? get().propertyId : null }),

  setMode: (m) => {
    if (m === get().mode) return;
    persistMode(m);
    // Vertical-specific type filter no longer applies; leave detail views.
    set((s) => ({
      mode: m,
      view: s.view === "detail" ? "home" : s.view,
      propertyId: s.view === "detail" ? null : s.propertyId,
      searchFilters: { ...s.searchFilters, houseType: "", bedrooms: undefined },
    }));
  },

  openProperty: (id) => set({ view: "detail", propertyId: id }),

  setLang: (l) => {
    if (l === get().lang) return;
    persistLang(l);
    set({ lang: l });
  },

  goSearch: (filters) =>
    set((s) => ({
      view: "search",
      searchFilters: { ...s.searchFilters, ...filters },
    })),

  openAuth: () => set({ authOpen: true }),

  closeAuth: () => set({ authOpen: false }),

  setSearchFilters: (f) =>
    set((s) => ({ searchFilters: { ...s.searchFilters, ...f } })),

  clearFilters: () => set({ searchFilters: { ...EMPTY_FILTERS } }),

  setSavedIds: (ids) => {
    persistSavedIds(ids);
    set({ savedIds: ids });
  },

  toggleSavedLocal: (id, saved) =>
    set((s) => {
      const savedIds = saved
        ? [...new Set([...s.savedIds, id])]
        : s.savedIds.filter((x) => x !== id);
      persistSavedIds(savedIds);
      return { savedIds };
    }),

  addRecentContact: (c) => {
    const list = [c, ...get().recentContacts.filter((x) => x.propertyId !== c.propertyId)].slice(0, 20);
    persistRecentContacts(list);
    set({ recentContacts: list });
  },

  clearRecentContacts: () => {
    persistRecentContacts([]);
    set({ recentContacts: [] });
  },

  setImpersonation: (i) => set({ impersonation: i }),

  openListing: (edit = null) => set({ listingOpen: true, listingEdit: edit }),
  closeListing: () => set({ listingOpen: false, listingEdit: null }),
  quickListOpen: false,
  openQuickList: () => set({ quickListOpen: true }),
  closeQuickList: () => set({ quickListOpen: false }),
  bumpListings: () => set((s) => ({ listingsVersion: s.listingsVersion + 1 })),
  setPaymentDialog: (p) => set({ paymentDialog: p }),

  helpOpen: false,
  helpArticle: null,
  openHelp: (article) => set({ helpOpen: true, helpArticle: article ?? null }),
  closeHelp: () => set({ helpOpen: false, helpArticle: null }),
  setHelpArticle: (a) => set({ helpArticle: a }),

  omniOpen: false,
  setOmniOpen: (v) => set({ omniOpen: v }),

  directoryQuery: "",
  setDirectoryQuery: (q) => set({ directoryQuery: q }),
}));

// Hydrate device-local state once on the client.
if (typeof window !== "undefined") {
  useStore.setState({
    recentContacts: loadRecentContacts(),
    mode: loadMode(),
    savedIds: loadSavedIds(),
    lang: loadLang(),
  });
}
