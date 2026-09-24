"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Clock,
  House,
  ListPlus,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { HelpArticle } from "@/lib/store";
import { publicApi } from "@/lib/api";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  HOUSE_TYPE_LABELS,
  SCOPE_LABELS,
  type SearchScope,
  type SuggestGroups,
  type SuggestItem,
} from "@/lib/types";
import { parseQuery, describeParsed } from "@/lib/query-parse";
import { findBlock } from "@/lib/blocks-near";
import { Photo } from "./photo";

/**
 * ─── iShim Universal Search ("Google-style") ─────────────────────────
 * One omnibox that searches EVERYTHING on iShim — homes, business spaces,
 * places, owners & agents, listing types and site pages — across both
 * verticals, with live grouped suggestions, recent searches, trending
 * places and full keyboard navigation (↑ ↓ Enter Esc, ⌘K / "/" to open).
 */

const RECENTS_KEY = "ishim_recent_searches";
const MAX_RECENTS = 8;

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function persistRecents(list: string[]) {
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
  } catch {
    // storage unavailable
  }
}

/** Google-style bold of the matched substring. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-foreground">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}

const SCOPES: SearchScope[] = ["", "HOME", "BUSINESS"];

function ScopeChips({
  value,
  onChange,
  className,
}: {
  value: SearchScope;
  onChange: (s: SearchScope) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Search scope"
      className={cn("flex items-center gap-0.5 rounded-full bg-muted p-0.5", className)}
    >
      {SCOPES.map((s) => {
        const active = value === s;
        return (
          <button
            key={s || "all"}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active || undefined}
            onClick={() => onChange(s)}
            className={cn(
              "min-h-7 rounded-full px-3 text-[12.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? s === "BUSINESS"
                  ? "bg-amber-500/90 text-white shadow-sm"
                  : s === "HOME"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {SCOPE_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}

/** Flattens grouped suggestions into one keyboard-navigable list. */
function flattenGroups(groups: SuggestGroups): SuggestItem[] {
  return [
    ...groups.places,
    ...groups.nearby,
    ...groups.filters,
    ...groups.listings,
    ...groups.people,
    ...groups.types,
    ...groups.pages,
  ];
}

type Variant = "hero" | "page" | "overlay";

function ModeChip({ mode }: { mode?: string }) {
  if (!mode) return null;
  const business = mode === "BUSINESS";
  return (
    <span
      className={cn(
        "ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        business ? "bg-amber-500/10 text-amber-700" : "bg-primary/10 text-primary"
      )}
    >
      {business ? <Store className="size-3" aria-hidden /> : <House className="size-3" aria-hidden />}
      {business ? "Business" : "Home"}
    </span>
  );
}

const RowIcon = memo(function RowIcon({ item }: { item: SuggestItem }) {
  switch (item.type) {
    case "PROPERTY":
      return (
        <span className="relative block size-10 shrink-0 overflow-hidden rounded-xl bg-secondary">
          <Photo
            src={item.image || null}
            alt=""
            className="absolute inset-0 h-full w-full"
            iconClassName="size-4"
          />
        </span>
      );
    case "PERSON": {
      const initials = item.title
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");
      return (
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white",
            item.role === "AGENT" ? "bg-foreground" : "bg-primary"
          )}
          aria-hidden
        >
          {initials || "?"}
        </span>
      );
    }
    case "PLACE":
      return (
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"
          aria-hidden
        >
          <MapPin className="size-5" />
        </span>
      );
    case "NEARBY":
      return (
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
          aria-hidden
        >
          <Navigation className="size-5" />
        </span>
      );
    case "FILTER":
      return (
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"
          aria-hidden
        >
          <SlidersHorizontal className="size-5" />
        </span>
      );
    case "TYPE":
      return (
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"
          aria-hidden
        >
          <Tag className="size-5" />
        </span>
      );
    default:
      return (
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-foreground/70"
          aria-hidden
        >
          <Sparkles className="size-5" />
        </span>
      );
  }
});

RowIcon.displayName = "RowIcon";

export function OmniSearchPanel({
  variant,
  autoFocus,
  onClose,
  initialQuery,
  scope: controlledScope,
  onScopeChange,
}: {
  variant: Variant;
  autoFocus?: boolean;
  onClose?: () => void;
  /** Seed the bar with an existing query (search view hands off filters.q). */
  initialQuery?: string;
  /** Controlled scope (search view syncs its chips with this). */
  scope?: SearchScope;
  onScopeChange?: (s: SearchScope) => void;
}) {
  const goSearch = useStore((s) => s.goSearch);
  const openProperty = useStore((s) => s.openProperty);
  const setView = useStore((s) => s.setView);
  const setMode = useStore((s) => s.setMode);
  const openListing = useStore((s) => s.openListing);
  const openQuickList = useStore((s) => s.openQuickList);
  const user = useStore((s) => s.user);
  const openHelp = useStore((s) => s.openHelp);
  const setDirectoryQuery = useStore((s) => s.setDirectoryQuery);

  const [query, setQuery] = useState(initialQuery ?? "");
  const [innerScope, setInnerScope] = useState<SearchScope>("");
  const scope = controlledScope ?? innerScope;
  const setScope = (s: SearchScope) => {
    setInnerScope(s);
    onScopeChange?.(s);
  };

  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<SuggestGroups | null>(null);
  const [active, setActive] = useState(-1);
  // Lazy init reads localStorage (client-only); the dropdown renders nothing
  // until it opens, so there is no hydration mismatch either way.
  const [recents, setRecents] = useState<string[]>(() => loadRecents());
  const [trending, setTrending] = useState<Array<{ block: string; count: number }>>([]);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Trending = busiest blocks across BOTH verticals.
  useEffect(() => {
    let alive = true;
    publicApi
      .getBlockStats()
      .then((d) => {
        if (!alive) return;
        setTrending(
          Object.entries(d.counts)
            .map(([block, count]) => ({ block, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 4)
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Debounced + abortable suggestion fetch. "Loading" is derived: the typed
  // query differs from the last fetched one while a request is in flight.
  const [fetchedQ, setFetchedQ] = useState("");
  useEffect(() => {
    const q = query.trim();
    const controller = new AbortController();
    if (!q) {
      // Clear asynchronously (never setState synchronously in the effect body).
      const clear = window.setTimeout(() => {
        if (controller.signal.aborted) return;
        setGroups(null);
        setFetchedQ("");
        setActive(-1);
      }, 0);
      return () => {
        controller.abort();
        window.clearTimeout(clear);
      };
    }
    const t = window.setTimeout(() => {
      publicApi
        .searchSuggest(q, scope)
        .then((res) => {
          if (controller.signal.aborted) return;
          setGroups(res.groups);
          setFetchedQ(q);
          setActive(-1);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setGroups(null);
          setFetchedQ(q);
        });
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [query, scope]);
  const loading = query.trim() !== "" && fetchedQ !== query.trim();

  const items = useMemo(() => (groups ? flattenGroups(groups) : []), [groups]);
  const dropdownOpen = open;
  // Engine interpretation of what's typed — powers the "See all results"
  // subtitle so the user sees how the query will be applied.
  const parsedPreview = useMemo(() => parseQuery(query), [query]);

  // Close on outside click (inline variants only — overlay closes itself).
  useEffect(() => {
    if (!dropdownOpen || variant === "overlay") return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [dropdownOpen, variant]);

  const saveRecent = useCallback((q: string) => {
    const v = q.trim();
    if (!v) return;
    // Read-persist-set (never side-effect inside a state updater — the panel
    // often unmounts right after saving, which would drop the write).
    const next = [
      v,
      ...loadRecents().filter((x) => x.toLowerCase() !== v.toLowerCase()),
    ].slice(0, MAX_RECENTS);
    persistRecents(next);
    setRecents(next);
  }, []);

  const runQuery = useCallback(
    (q: string, s: SearchScope) => {
      saveRecent(q);
      // Engine-style: structured parts ("under 5000", "2 bhk", "near X")
      // become real filters; the rest stays as the keyword query.
      const parsed = parseQuery(q);
      const blocks = useStore.getState().settings?.blocks ?? [];
      const nearBlock = parsed.nearText ? findBlock(parsed.nearText, blocks) : undefined;
      goSearch({
        q: parsed.tokens,
        scope: s,
        block: nearBlock ?? "",
        houseType: "",
        minRent: parsed.minRent,
        maxRent: parsed.maxRent,
        bedrooms: parsed.bedrooms,
        near: !!nearBlock,
      });
      setOpen(false);
      inputRef.current?.blur();
      onClose?.();
    },
    [goSearch, onClose, saveRecent]
  );

  const activate = useCallback(
    (item: SuggestItem) => {
      switch (item.type) {
        case "PLACE":
          saveRecent(item.title);
          goSearch({
            block: item.title,
            q: "",
            scope,
            houseType: "",
            minRent: undefined,
            maxRent: undefined,
            bedrooms: undefined,
            near: false,
          });
          break;
        case "NEARBY":
          saveRecent(`Near ${item.around ?? item.title}`);
          goSearch({
            block: item.around ?? "",
            q: "",
            scope,
            houseType: "",
            minRent: undefined,
            maxRent: undefined,
            bedrooms: undefined,
            near: true,
          });
          break;
        case "FILTER":
          saveRecent(query.trim());
          goSearch({
            minRent: item.minRent,
            maxRent: item.maxRent,
            bedrooms: item.bedrooms,
            q: "",
            block: "",
            houseType: "",
            near: false,
            scope,
          });
          break;
        case "PROPERTY":
          openProperty(item.id);
          break;
        case "PERSON":
          setDirectoryQuery(item.title);
          setView("directory");
          break;
        case "TYPE": {
          const m = item.mode === "BUSINESS" ? "BUSINESS" : "HOME";
          setMode(m);
          goSearch({ houseType: item.houseType ?? "", block: "", q: "", scope: m, near: false });
          break;
        }
        case "PAGE": {
          const a = item.action ?? {};
          if (a.list) openListing();
          else if (a.view) setView(a.view);
          else if (a.help) openHelp(a.help as HelpArticle);
          break;
        }
      }
      setOpen(false);
      inputRef.current?.blur();
      onClose?.();
    },
    [goSearch, onClose, openHelp, openListing, openProperty, saveRecent, scope, setDirectoryQuery, setMode, setView, query]
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!dropdownOpen) {
        setOpen(true);
        return;
      }
      setActive((i) => (items.length === 0 ? -1 : (i + 1) % (items.length + 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!dropdownOpen) {
        setOpen(true);
        return;
      }
      setActive((i) =>
        items.length === 0 ? -1 : (i - 1 + items.length + 1) % (items.length + 1)
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const q = query.trim();
      if (q && active >= 0 && active < items.length) {
        activate(items[active]);
      } else if (q) {
        runQuery(q, scope);
      } else if (variant === "overlay") {
        onClose?.();
      }
    } else if (e.key === "Escape") {
      if (variant === "overlay") {
        e.preventDefault();
        onClose?.();
      } else if (query) {
        setQuery("");
      } else {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
  };

  // Keep the active row in view during keyboard navigation.
  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const showPlaceholder =
    variant === "hero"
      ? "Search everything on iShim…"
      : "Search homes, shops, places, owners, pages…";

  const rows = (list: SuggestItem[], kind: SuggestItem["type"], label: string) =>
    list.length === 0 ? null : (
      <div className="px-2 py-1.5" role="group" aria-label={label}>
        <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {list.map((item) => {
          const idx = items.indexOf(item);
          const isActive = idx === active;
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={isActive}
              data-idx={idx}
              onMouseEnter={() => setActive(idx)}
              onClick={() => activate(item)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline-none",
                isActive ? "bg-accent" : "hover:bg-accent/60"
              )}
            >
              <RowIcon item={item} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] leading-tight text-foreground">
                  <Highlight text={item.title} query={query} />
                  {item.type === "PERSON" && item.verified ? (
                    <BadgeCheck className="mb-0.5 ml-1 inline size-4 shrink-0 text-primary" aria-label="Verified" />
                  ) : null}
                </span>
                {item.subtitle ? (
                  <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                    {item.subtitle}
                  </span>
                ) : null}
              </span>
              {item.type === "PROPERTY" ? <ModeChip mode={item.mode} /> : null}
              <ArrowRight
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-opacity",
                  isActive ? "opacity-100" : "opacity-0"
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    );

  const hasResults = items.length > 0;

  return (
    <div ref={rootRef} className="relative w-full" data-omni={variant}>
      {/* ── Input row (Google-style pill) ── */}
      <div
        className={cn(
          "flex items-center gap-2 bg-card transition-shadow",
          variant === "hero" &&
            cn(
              "h-14 rounded-full pl-5 pr-2 shadow-lg ring-1 ring-black/5",
              dropdownOpen && "rounded-b-none rounded-t-3xl shadow-xl"
            ),
          variant === "page" &&
            cn(
              "h-12 rounded-2xl pl-4 pr-2 shadow-sm ring-1 ring-black/5",
              dropdownOpen && "rounded-b-none rounded-t-2xl shadow-md"
            ),
          variant === "overlay" && "h-14 rounded-2xl pl-4 pr-2 shadow-sm ring-1 ring-border"
        )}
      >
        <Search
          className={cn(
            "size-5 shrink-0",
            loading ? "animate-pulse text-primary" : "text-muted-foreground"
          )}
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={dropdownOpen}
          aria-controls="omni-suggestions"
          aria-autocomplete="list"
          aria-label="Search everything on iShim"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setRecents(loadRecents());
          }}
          onKeyDown={onInputKeyDown}
          placeholder={showPlaceholder}
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground/80"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : variant === "overlay" ? (
          <kbd className="mr-1 hidden shrink-0 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
            ESC
          </kbd>
        ) : null}
        <ScopeChips
          value={scope}
          onChange={setScope}
          className="hidden shrink-0 md:flex"
        />
      </div>

      {/* Scope chips under the bar on mobile (Google's "tabs under the box") */}
      <div className="mt-2 flex justify-center md:hidden">
        <ScopeChips value={scope} onChange={setScope} />
      </div>

      {/* ── Dropdown panel ── */}
      <AnimatePresence>
        {dropdownOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            id="omni-suggestions"
            role="listbox"
            aria-label="Search suggestions"
            ref={listRef}
            className={cn(
              "overflow-y-auto overscroll-contain thin-scrollbar bg-card",
              variant === "hero" &&
                "absolute inset-x-0 top-full z-50 max-h-[min(60vh,480px)] rounded-b-3xl pb-2 shadow-xl ring-1 ring-black/5",
              variant === "page" &&
                "absolute inset-x-0 top-full z-50 mt-1.5 max-h-[min(60vh,480px)] rounded-2xl pb-2 shadow-xl ring-1 ring-black/5",
              variant === "overlay" && "mt-2 max-h-[52vh] rounded-2xl pb-2"
            )}
          >
            {variant === "overlay" ? (
              <div className="flex items-center justify-end px-4 pt-1.5 md:hidden">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close search"
                  className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-accent"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ) : null}

            {!query ? (
              <>
                {recents.length > 0 ? (
                  <div className="px-2 py-1.5" role="group" aria-label="Recent searches">
                    <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Recent searches
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          persistRecents([]);
                          setRecents([]);
                        }}
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        Clear
                      </button>
                    </div>
                    {recents.map((r) => (
                      <div
                        key={r}
                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2"
                      >
                        <Clock className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
                        <button
                          type="button"
                          onClick={() => {
                            setQuery(r);
                            inputRef.current?.focus();
                          }}
                          className="min-w-0 flex-1 truncate text-left text-[15px] text-foreground"
                        >
                          {r}
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove "${r}" from recent searches`}
                          onClick={() => {
                            const next = recents.filter((x) => x !== r);
                            persistRecents(next);
                            setRecents(next);
                          }}
                          className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {trending.length > 0 ? (
                  <div className="px-2 py-1.5" role="group" aria-label="Trending places">
                    <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Trending places
                    </p>
                    {trending.map((t) => (
                      <button
                        key={t.block}
                        type="button"
                        onClick={() => {
                          saveRecent(t.block);
                          goSearch({ block: t.block, q: "", scope });
                          setOpen(false);
                          inputRef.current?.blur();
                          onClose?.();
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none"
                      >
                        <span
                          className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"
                          aria-hidden
                        >
                          <TrendingUp className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] leading-tight text-foreground">
                            {t.block}
                          </span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                            {t.count} live {t.count === 1 ? "listing" : "listings"} right now
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="px-2 pb-1 pt-1.5" role="group" aria-label="Quick links">
                  <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Jump to
                  </p>
                  {(
                    [
                      { title: "List your property", subtitle: "Homes & business spaces", icon: ListPlus, run: () => (user && (user.role === "OWNER" || user.role === "AGENT") ? openListing() : openQuickList()) },
                      { title: "Know your Owners", subtitle: "Every owner & agent on iShim", icon: BadgeCheck, run: () => setView("directory") },
                      { title: "Pricing & fees", subtitle: "Free period, plans and charges", icon: Sparkles, run: () => setView("pricing") },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.title}
                      type="button"
                      onClick={() => {
                        p.run();
                        setOpen(false);
                        onClose?.();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none"
                    >
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"
                        aria-hidden
                      >
                        <p.icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] leading-tight text-foreground">
                          {p.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                          {p.subtitle}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : hasResults ? (
              <>
                {rows(groups!.places, "PLACE", "Places")}
                {rows(groups!.nearby, "NEARBY", "Nearby")}
                {rows(groups!.filters, "FILTER", "Smart filters")}
                {rows(groups!.listings, "PROPERTY", "Homes & spaces")}
                {rows(groups!.people, "PERSON", "People")}
                {rows(groups!.types, "TYPE", "Types")}
                {rows(groups!.pages, "PAGE", "Pages")}
                {query.trim() ? (
                  <button
                    type="button"
                    data-idx={items.length}
                    onMouseEnter={() => setActive(items.length)}
                    onClick={() => runQuery(query.trim(), scope)}
                    className={cn(
                      "mx-2 mb-1 mt-1.5 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors focus-visible:outline-none",
                      active === items.length ? "bg-accent" : "hover:bg-accent/60"
                    )}
                  >
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                      aria-hidden
                    >
                      <Search className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-foreground">
                        See all results for{" "}
                        <span className="font-semibold">“{query.trim()}”</span>
                      </span>
                      {parsedPreview.parts.length > 0 ? (
                        <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                          {describeParsed(parsedPreview)}
                        </span>
                      ) : null}
                    </span>
                    <kbd className="hidden shrink-0 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
                      Enter
                    </kbd>
                  </button>
                ) : null}
              </>
            ) : (
              <div className="px-6 py-8 text-center">
                <Search className="mx-auto size-6 text-muted-foreground/50" aria-hidden />
                <p className="mt-2 text-sm font-medium text-foreground">
                  No matches for “{query.trim()}”
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Try a place ("near Dungrei"), a budget ("under 5000"), a type
                  ("cafe"), or an owner’s name or phone.
                </p>
              </div>
            )}

            {variant === "overlay" ? (
              <p className="hidden border-t px-4 pb-1 pt-2 text-center text-[11px] text-muted-foreground sm:block">
                ↑↓ navigate · Enter select · Esc close
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Global Google-style search overlay (desktop nav pill, ⌘K / "/"). */
export function OmniSearchOverlay() {
  const omniOpen = useStore((s) => s.omniOpen);
  const setOmniOpen = useStore((s) => s.setOmniOpen);

  // Body scroll lock while the overlay is open + document-level Escape so
  // it closes even when focus is outside the panel.
  useEffect(() => {
    if (!omniOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOmniOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [omniOpen, setOmniOpen]);

  if (!omniOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80]"
      role="dialog"
      aria-modal="true"
      aria-label="Search iShim"
    >
      <button
        type="button"
        aria-label="Close search"
        onClick={() => setOmniOpen(false)}
        className="absolute inset-0 h-full w-full cursor-default bg-black/45 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: -14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-3 top-[max(3rem,8vh)] mx-auto max-w-2xl overflow-hidden rounded-3xl bg-card shadow-2xl ring-1 ring-black/10"
      >
        <div className="p-3 pb-0">
          <OmniSearchPanel
            key="overlay"
            variant="overlay"
            autoFocus
            onClose={() => setOmniOpen(false)}
          />
        </div>
      </motion.div>
    </div>
  );
}

/** Compact Google-style pill for the desktop navbar. */
export function OmniSearchTrigger() {
  const setOmniOpen = useStore((s) => s.setOmniOpen);
  const mode = useStore((s) => s.mode);
  return (
    <button
      type="button"
      onClick={() => setOmniOpen(true)}
      aria-label="Search everything on iShim"
      className="group flex h-10 w-[230px] items-center gap-2.5 rounded-full border border-border/80 bg-muted/60 px-3.5 text-left text-sm text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted hover:text-foreground hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-[300px]"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        Search {mode === "BUSINESS" ? "shops, offices" : "homes, places"}…
      </span>
      <kbd className="hidden shrink-0 rounded-md border bg-background px-1.5 py-0.5 text-[10px] font-medium lg:block">
        ⌘K
      </kbd>
    </button>
  );
}
