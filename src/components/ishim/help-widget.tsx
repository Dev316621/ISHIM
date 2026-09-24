"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BadgeCheck,
  BadgeIndianRupee,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  House,
  Info,
  KeyRound,
  LifeBuoy,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  ScrollText,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useStore, type HelpArticle } from "@/lib/store";
import { assistantApi, contentApi, type ContentOverride } from "@/lib/api";
import {
  DEFAULT_CONTENT,
  type AboutData,
  type ContactData,
  type ContentData,
  type FaqData,
  type HelpArticleKey,
  type HowData,
  type SectionsData,
} from "@/lib/default-content";

/* ------------------------------------------------------------------ */
/* Content menu                                                        */
/* ------------------------------------------------------------------ */

/** iShim support WhatsApp line (country code 91 + number) — support CTA. */
const SUPPORT_WA = "919000000001";
const waUrl = (msg: string, number: string = SUPPORT_WA) =>
  `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;

/* ------------------------------------------------------------------ */
/* AI assistant chat                                                   */

const AI_GREETING =
  "Hi! I know every live listing on iShim — rents, areas, water, furnishing — plus how visits, fees and agent help work. What are you looking for?";

const AI_FALLBACK =
  "Sorry — I couldn't answer that just now. Please try again, or WhatsApp the iShim desk and a real person will help you right away.";

type ChatMsg = { role: "user" | "assistant"; content: string };

const CHIPS: { label: string; ask?: string }[] = [
  { label: "Water in Viewland homes?", ask: "Is water available in Viewland homes?" },
  { label: "Homes under ₹10,000", ask: "Show me homes under ₹10,000 per month" },
  { label: "How do I book a visit?", ask: "How do I book a visit to see a home?" },
  { label: "Fees & charges", ask: "What fees does iShim charge?" },
];

const MENU: {
  key: HelpArticle;
  title: string;
  desc: string;
  icon: typeof Info;
}[] = [
  {
    key: "how",
    title: "How iShim works",
    desc: "Search, chat, move in — in three steps.",
    icon: HelpCircle,
  },
  {
    key: "about",
    title: "About iShim",
    desc: "Who we are and why we built this.",
    icon: Info,
  },
  {
    key: "contact",
    title: "Contact",
    desc: "WhatsApp, email and office hours.",
    icon: MessageCircle,
  },
  {
    key: "support",
    title: "Support",
    desc: "Answers to the questions we hear most.",
    icon: LifeBuoy,
  },
  {
    key: "privacy",
    title: "Privacy",
    desc: "What we collect and how it is used.",
    icon: ShieldCheck,
  },
  {
    key: "terms",
    title: "Terms & Conditions",
    desc: "The rules of using iShim.",
    icon: FileText,
  },
  {
    key: "policy",
    title: "Listing & refund policy",
    desc: "Listing rules and the success-fee policy.",
    icon: ScrollText,
  },
  {
    key: "business",
    title: "Business",
    desc: "iShim by eX Holdings — for agents & partners.",
    icon: Building2,
  },
];

/* ------------------------------------------------------------------ */
/* Data-driven article rendering (built-in defaults or admin overrides) */

const STEP_ICONS = [Search, MessageCircle, KeyRound, House, Info, HelpCircle];

function HowBody({ data }: { data: HowData }) {
  return (
    <div className="space-y-3">
      {data.steps.map((s, i) => {
        const Icon = STEP_ICONS[i % STEP_ICONS.length];
        return (
          <div key={`${i}-${s.title}`} className="rounded-2xl bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Icon className="size-4 text-primary" aria-hidden />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Step {i + 1}
              </span>
            </div>
            <p className="mt-2.5 font-medium">{s.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{s.body}</p>
          </div>
        );
      })}
      {data.note ? (
        <p className="flex items-start gap-2 rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
          <BadgeIndianRupee className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span className="font-medium text-foreground">{data.note}</span>
        </p>
      ) : null}
    </div>
  );
}

function AboutBody({ data }: { data: AboutData }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
      <p className="text-foreground">{data.lead}</p>
      {data.bullets.length > 0 && (
        <ul className="space-y-2">
          {data.bullets.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
      {data.outro ? <p>{data.outro}</p> : null}
    </div>
  );
}

function ContactBody({ data }: { data: ContactData }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{data.lead}</p>
      <div className="space-y-2">
        <a
          href={waUrl("Hi iShim! I need some help.", data.whatsapp.number)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-3 rounded-2xl border border-border/70 p-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <MessageCircle className="size-4 text-primary" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{data.whatsapp.label}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {data.whatsapp.sub}
            </span>
          </span>
          <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
        </a>
        <a
          href={`mailto:${data.email.address}`}
          className="flex min-h-11 items-center gap-3 rounded-2xl border border-border/70 p-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-4 text-primary" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{data.email.label}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {data.email.sub}
            </span>
          </span>
          <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
        </a>
        <div className="flex min-h-11 items-center gap-3 rounded-2xl border border-border/70 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <MapPin className="size-4 text-primary" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-medium">{data.location.label}</span>
            <span className="block text-xs text-muted-foreground">
              {data.location.sub}
            </span>
          </span>
        </div>
        <div className="flex min-h-11 items-center gap-3 rounded-2xl border border-border/70 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Clock className="size-4 text-primary" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-medium">{data.hours.label}</span>
            <span className="block text-xs text-muted-foreground">
              {data.hours.sub}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function SupportBody({ data }: { data: FaqData }) {
  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible className="rounded-2xl border border-border/70 px-4">
        {data.faqs.map((f, i) => (
          <AccordionItem key={`${i}-${f.q}`} value={`faq-${i}`} className="last:border-none">
            <AccordionTrigger className="text-left text-sm font-medium">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="rounded-2xl bg-secondary/70 p-4 text-center">
        <p className="text-sm text-muted-foreground">Still need help?</p>
        <div className="mt-3 flex justify-center">
          <WhatsAppCta message="Hi iShim! I have a question." />
        </div>
      </div>
    </div>
  );
}

function SectionsBody({ data }: { data: SectionsData }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      {data.sections.map((s, i) => (
        <div key={`${i}-${s.h}`}>
          <p className="font-medium text-foreground">{s.h}</p>
          <p className="mt-1 text-muted-foreground">{s.p}</p>
        </div>
      ))}
    </div>
  );
}

function ArticleBody({ slug, data }: { slug: HelpArticleKey; data: ContentData }) {
  switch (slug) {
    case "how":
      return <HowBody data={data as HowData} />;
    case "about":
      return <AboutBody data={data as AboutData} />;
    case "contact":
      return <ContactBody data={data as ContactData} />;
    case "support":
      return <SupportBody data={data as FaqData} />;
    default:
      return <SectionsBody data={data as SectionsData} />;
  }
}

function WhatsAppCta({ message, label }: { message: string; label?: string }) {
  return (
    <Button asChild className="rounded-full">
      <a href={waUrl(message)} target="_blank" rel="noopener noreferrer">
        <MessageCircle aria-hidden />
        {label ?? "WhatsApp us"}
      </a>
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Draggable button + floating panel                                   */
/* ------------------------------------------------------------------ */

const BTN = 56; // size-14
const EDGE = 12; // min distance to viewport edges
const GAP = 12; // gap between panel and button
const PANEL_W = 384; // desktop panel width

type Pos = { x: number; y: number };

function clampPos(p: Pos): Pos {
  const maxX = Math.max(EDGE, window.innerWidth - BTN - EDGE);
  const maxY = Math.max(EDGE, window.innerHeight - BTN - EDGE);
  return {
    x: Math.min(Math.max(EDGE, p.x), maxX),
    y: Math.min(Math.max(EDGE, p.y), maxY),
  };
}

/** Desktop panel anchored above/beside the button, clamped to the viewport. */
function panelStyle(pos: Pos | null): React.CSSProperties | undefined {
  if (!pos || window.innerWidth < 768) return undefined;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxH = Math.min(600, vh - 96);
  const right = pos.x + BTN / 2 > vw / 2;

  const bottom = Math.max(
    GAP,
    Math.min(vh - pos.y + GAP, vh - maxH - GAP)
  );

  if (right) {
    return {
      right: Math.max(GAP, vw - pos.x - BTN),
      bottom,
      maxHeight: maxH,
      width: Math.min(PANEL_W, vw - EDGE * 2),
    };
  }
  return {
    left: Math.max(GAP, Math.min(pos.x, vw - PANEL_W - GAP)),
    bottom,
    maxHeight: maxH,
    width: Math.min(PANEL_W, vw - EDGE * 2),
  };
}

export function HelpWidget() {
  const helpOpen = useStore((s) => s.helpOpen);
  const helpArticle = useStore((s) => s.helpArticle);
  const openHelp = useStore((s) => s.openHelp);
  const closeHelp = useStore((s) => s.closeHelp);
  const setHelpArticle = useStore((s) => s.setHelpArticle);
  const openQuickList = useStore((s) => s.openQuickList);

  const [pos, setPos] = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);
  const [overrides, setOverrides] = useState<
    Partial<Record<HelpArticle, ContentOverride>>
  >({});
  const [hidden, setHidden] = useState<HelpArticle[]>([]);

  // AI chat — state lives here (not in the panel) so the conversation
  // survives closing and reopening the help panel.
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", content: AI_GREETING }]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const drag = useRef<{
    px: number;
    py: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  // Keep the newest message visible while chatting.
  useEffect(() => {
    if (helpOpen && chatOpen) {
      chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, sending, helpOpen, chatOpen]);

  // Focus the chat input when the conversation opens.
  useEffect(() => {
    if (helpOpen && chatOpen) chatInputRef.current?.focus({ preventScroll: true });
  }, [helpOpen, chatOpen]);

  const sendQuestion = async (raw: string) => {
    const q = raw.trim();
    if (!q || sending) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setChatInput("");
    setSending(true);
    try {
      const res = await assistantApi.ask(
        q,
        next.slice(0, -1).filter((m) => m.role !== "assistant" || m.content !== AI_GREETING).slice(-6)
      );
      setMessages([...next, { role: "assistant", content: res.answer }]);
    } catch {
      setMessages([...next, { role: "assistant", content: AI_FALLBACK }]);
    } finally {
      setSending(false);
    }
  };

  // Re-clamp the button inside the viewport on resize (only matters once dragged).
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampPos(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close on Escape while open.
  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHelp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen, closeHelp]);

  // Focus the panel when it opens (keyboard / screen-reader friendly).
  useEffect(() => {
    if (helpOpen) panelRef.current?.focus({ preventScroll: true });
  }, [helpOpen]);

  // Fresh admin-customized content each time the panel opens.
  useEffect(() => {
    if (!helpOpen) return;
    let alive = true;
    contentApi
      .getOverrides()
      .then((res) => {
        if (alive) {
          setOverrides(res.pages ?? {});
          setHidden(res.hidden ?? []);
        }
      })
      .catch(() => {
        // Offline / error — built-in defaults keep working.
      });
    return () => {
      alive = false;
    };
  }, [helpOpen]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Until the first drag, the button is CSS-positioned; capture its coords now.
    let start = pos;
    if (!start) {
      const rect = e.currentTarget.getBoundingClientRect();
      start = { x: rect.left, y: rect.top };
      setPos(start);
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: start.x, oy: start.y, moved: false };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    setPos(clampPos({ x: d.ox + dx, y: d.oy + dy }));
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>, tapped: boolean) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (!tapped && !d.moved) return;
    if (d.moved) {
      // Magnetic snap to the nearest horizontal edge.
      setPos((p) =>
        p
          ? clampPos({
              x:
                p.x + BTN / 2 > window.innerWidth / 2
                  ? window.innerWidth - BTN - EDGE
                  : EDGE,
              y: p.y,
            })
          : p
      );
    } else if (tapped) {
      if (helpOpen) closeHelp();
      else openHelp();
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // capture already released (e.g. after pointercancel)
    }
  };

  const activeArticle = helpArticle
    ? MENU.find((m) => m.key === helpArticle)
    : null;
  const override = helpArticle ? overrides[helpArticle] : undefined;
  const articleTitle =
    (override?.title as string | undefined) ?? activeArticle?.title ?? "";

  const pStyle = panelStyle(pos);
  const origin = pStyle?.right !== undefined ? "bottom right" : "bottom left";

  return (
    <>
      {/* Click-outside / backdrop (dimmed sheet backdrop on mobile) */}
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            key="help-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[45] bg-black/25 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-0"
            onClick={closeHelp}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Floating panel */}
      <AnimatePresence>
        {helpOpen && (
          <motion.section
            key="help-panel"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label="Help and information"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ transformOrigin: origin, ...pStyle }}
            className={cn(
              "fixed z-[46] flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl outline-none",
              // Mobile (< md): bottom sheet above the bottom nav.
              // Desktop: positioned via inline style (panelStyle).
              "max-md:inset-x-3 max-md:bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] max-md:max-h-[min(600px,calc(100dvh-10rem))]"
            )}
          >
            {/* Header */}
            <header className="flex items-center gap-2 border-b border-border/60 bg-background/60 px-3 py-2.5">
              {activeArticle || chatOpen ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Back to help menu"
                  onClick={() => (chatOpen ? setChatOpen(false) : setHelpArticle(null))}
                  className="size-8 rounded-full"
                >
                  <ChevronLeft aria-hidden />
                </Button>
              ) : (
                <span
                  aria-hidden
                  className="ml-1 flex size-8 items-center justify-center rounded-full bg-primary/10"
                >
                  <HelpCircle className="size-4 text-primary" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-tight">
                  {chatOpen ? "Ask iShim AI" : activeArticle ? articleTitle : "Help & information"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {chatOpen
                    ? "Answers grounded in live listings"
                    : activeArticle
                      ? "iShim Help"
                      : "How iShim works, policies and contact"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close help"
                onClick={closeHelp}
                className="size-8 rounded-full"
              >
                <X aria-hidden />
              </Button>
            </header>

            {/* Body */}
            {chatOpen ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div
                  ref={chatScrollRef}
                  role="log"
                  aria-live="polite"
                  aria-label="Conversation with the iShim assistant"
                  className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-3"
                >
                  {messages.map((m, i) => (
                    <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                          m.role === "user"
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md bg-muted text-foreground"
                        )}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {sending ? (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" aria-hidden /> Thinking…
                      </div>
                    </div>
                  ) : null}
                  {messages.length <= 1 && !sending ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {CHIPS.map((c) => (
                        <button
                          key={c.label}
                          type="button"
                          onClick={() => c.ask && sendQuestion(c.ask)}
                          className="min-h-9 rounded-full bg-secondary/80 px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1 border-t border-border/60 bg-background/60 p-2.5">
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void sendQuestion(chatInput);
                    }}
                  >
                    <Input
                      ref={chatInputRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask about homes, areas, rent…"
                      aria-label="Ask the iShim assistant"
                      maxLength={500}
                      className="h-10 min-w-0 flex-1 rounded-full"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      aria-label="Send question"
                      disabled={sending || !chatInput.trim()}
                      className="size-10 shrink-0 rounded-full"
                    >
                      {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                    </Button>
                  </form>
                  <button
                    type="button"
                    onClick={() => {
                      closeHelp();
                      openQuickList();
                    }}
                    className="mx-auto flex min-h-9 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <KeyRound className="size-3.5" aria-hidden />
                    Listing a place? An agent does everything — start here
                  </button>
                </div>
              </div>
            ) : (
            <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain p-3">
              {activeArticle ? (
                <motion.div
                  key={activeArticle.key}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  {override?.banner ? (
                    <img
                      src={override.banner}
                      alt=""
                      className="mb-3 max-h-40 w-full rounded-2xl border border-border/60 object-cover"
                    />
                  ) : null}
                  <ArticleBody
                    slug={activeArticle.key}
                    data={override?.data ?? DEFAULT_CONTENT[activeArticle.key].data}
                  />
                </motion.div>
              ) : (
                <motion.nav
                  key="help-menu"
                  aria-label="Help topics"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="space-y-1"
                >
                  {/* AI assistant — pinned to the top of the menu */}
                  <button
                    type="button"
                    onClick={() => setChatOpen(true)}
                    className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Sparkles className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">Ask iShim AI</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        Instant answers — “water in Viewland?”, rents, visits…
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                  <p className="px-1 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Help topics
                  </p>
                  {MENU.filter((m) => !hidden.includes(m.key)).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setHelpArticle(m.key)}
                      className="flex min-h-11 w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <m.icon className="size-4 text-primary" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {overrides[m.key]?.title ?? m.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {m.desc}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  ))}
                </motion.nav>
              )}
            </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Draggable "?" button */}
      <button
        type="button"
        aria-label={helpOpen ? "Close help" : "Open help"}
        aria-expanded={helpOpen}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, true)}
        onPointerCancel={(e) => endDrag(e, false)}
        onContextMenu={(e) => e.preventDefault()}
        style={
          pos
            ? {
                left: 0,
                top: 0,
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${dragging ? 1.08 : 1})`,
                transition: dragging
                  ? "box-shadow 150ms ease"
                  : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease, box-shadow 200ms ease",
              }
            : undefined
        }
        className={cn(
          "fixed z-[47] flex size-14 touch-none select-none items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground shadow-xl ring-1 ring-black/10 hover:shadow-2xl",
          // Default resting spot until the first drag: above the mobile bottom
          // nav / bottom-right on desktop.
          !pos && "right-4 bottom-[5.75rem] md:right-6 md:bottom-6",
          dragging ? "cursor-grabbing shadow-2xl" : "cursor-grab",
          // Hide behind the mobile sheet while open; stays as an × toggle on desktop.
          helpOpen && "max-md:invisible max-md:opacity-0 max-md:pointer-events-none",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "transition-transform duration-200",
            helpOpen && "rotate-45 scale-110"
          )}
        >
          ?
        </span>
      </button>
    </>
  );
}
