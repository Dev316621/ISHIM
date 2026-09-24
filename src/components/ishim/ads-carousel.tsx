"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Globe,
  KeyRound,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { publicApi } from "@/lib/api";
import type { AdBanner } from "@/lib/types";
import { useListProperty } from "./use-list-property";

type SlideAction = { type: "SEARCH" | "LIST" | "URL"; url: string };

type Slide = {
  id: string;
  image: string;
  icon: LucideIcon;
  kicker: string;
  title: string;
  body: string;
  cta: string;
  slideAction: SlideAction;
};

const ACTION_ICON: Record<SlideAction["type"], LucideIcon> = {
  SEARCH: Sparkles,
  LIST: KeyRound,
  URL: Globe,
};

function toSlide(ad: AdBanner): Slide {
  const type = (["SEARCH", "LIST", "URL"] as const).includes(ad.action)
    ? ad.action
    : "SEARCH";
  return {
    id: ad.id,
    image: ad.image,
    icon: ACTION_ICON[type],
    kicker: ad.kicker,
    title: ad.title,
    body: ad.body,
    cta: ad.ctaLabel,
    slideAction: { type, url: ad.actionUrl },
  };
}

/** Built-in slides — used until ads load, and whenever the API has none. */
const FALLBACK_SLIDES: Slide[] = [
  {
    id: "ad-own",
    image: "/images/banner-own.jpg",
    icon: KeyRound,
    kicker: "For homeowners",
    title: "Own a home in Ukhrul?",
    body: "List it free for 36 months. Pay only the move-in fee when it's rented — no brokerage, ever.",
    cta: "List your property",
    slideAction: { type: "LIST", url: "" },
  },
  {
    id: "ad-fresh",
    image: "/images/banner-new.jpg",
    icon: Sparkles,
    kicker: "Just listed",
    title: "Fresh homes every week",
    body: "New verified listings across Hungpung, Viewland, TNL Ward and more.",
    cta: "Browse new homes",
    slideAction: { type: "SEARCH", url: "" },
  },
  {
    id: "ad-direct",
    image: "/images/banner-direct.jpg",
    icon: MessageCircle,
    kicker: "Why iShim",
    title: "Zero brokerage. Ever.",
    body: "Chat directly with owners on WhatsApp and deal directly — no middlemen taking a cut.",
    cta: "Find your home",
    slideAction: { type: "SEARCH", url: "" },
  },
];

const AUTOPLAY_MS = 5500;
const SWIPE_THRESHOLD = 56;
const VELOCITY_THRESHOLD = 420;

const slideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%" }),
  center: { x: "0%" },
  exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%" }),
};

export function AdsCarousel() {
  const [slides, setSlides] = useState<Slide[]>(FALLBACK_SLIDES);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const draggingRef = useRef(false);
  const goSearch = useStore((s) => s.goSearch);
  const onList = useListProperty();

  const n = slides.length;

  // Load admin-managed banners; keep built-ins as fallback.
  useEffect(() => {
    let alive = true;
    publicApi
      .getAds()
      .then((ads) => {
        if (!alive || ads.length === 0) return;
        setSlides(ads.map(toSlide));
        setIndex(0);
        setDir(1);
      })
      .catch(() => {
        // silent — built-in slides keep the banner alive
      });
    return () => {
      alive = false;
    };
  }, []);

  const go = useCallback(
    (next: number, direction?: number) => {
      const target = ((next % n) + n) % n;
      setDir(direction ?? (target >= index ? 1 : -1));
      setIndex(target);
    },
    [index, n]
  );

  // Autoplay — pauses on hover/focus/drag; respects prefers-reduced-motion.
  useEffect(() => {
    if (paused || n <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => {
      setDir(1);
      setIndex((i) => (i + 1) % n);
    }, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, paused, n]);

  // Preload banner images so slide changes never flash.
  useEffect(() => {
    slides.forEach((s) => {
      const img = new window.Image();
      img.src = s.image;
    });
  }, [slides]);

  const onAction = (slide: Slide) => {
    if (slide.slideAction.type === "LIST") onList();
    else if (slide.slideAction.type === "URL") {
      const url = slide.slideAction.url;
      if (/^https?:\/\/.+/.test(url)) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } else goSearch();
  };

  const onDragStart = () => {
    draggingRef.current = true;
    setPaused(true);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    draggingRef.current = false;
    setPaused(false);
    const { offset, velocity } = info;
    if (offset.x <= -SWIPE_THRESHOLD || velocity.x <= -VELOCITY_THRESHOLD) {
      go(index + 1, 1);
    } else if (offset.x >= SWIPE_THRESHOLD || velocity.x >= VELOCITY_THRESHOLD) {
      go(index - 1, -1);
    }
  };

  const safeIndex = Math.min(index, n - 1);
  const slide = slides[safeIndex];
  const SlideIcon = slide.icon;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="iShim highlights"
      className="mx-auto w-full max-w-6xl"
    >
      <div
        className="group relative h-[240px] overflow-hidden rounded-3xl bg-secondary shadow-sm ring-1 ring-black/5 sm:h-[300px] md:h-[340px]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => {
          if (!draggingRef.current) setPaused(false);
        }}
        onFocus={() => setPaused(true)}
        onBlur={() => {
          if (!draggingRef.current) setPaused(false);
        }}
      >
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={slide.id}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.16}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
          >
            {failed[slide.id] ? (
              <div
                role="img"
                aria-label=""
                className="absolute inset-0 bg-gradient-to-br from-secondary to-primary/30"
              />
            ) : (
              <motion.img
                src={slide.image}
                alt=""
                aria-hidden
                initial={{ scale: 1.07 }}
                animate={{ scale: 1 }}
                transition={{ duration: 6.5, ease: "easeOut" }}
                onError={() =>
                  setFailed((prev) => ({ ...prev, [slide.id]: true }))
                }
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {/* Legibility gradient (text side) */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent md:hidden"
            />

            <div className="relative flex h-full max-w-md flex-col items-start justify-center gap-2 p-6 sm:max-w-lg sm:p-10 md:max-w-xl md:p-12">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                <SlideIcon className="size-3.5" aria-hidden />
                {slide.kicker}
              </span>
              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl md:text-3xl">
                {slide.title}
              </h2>
              <p className="max-w-sm text-xs leading-relaxed text-white/85 sm:text-sm md:max-w-md md:text-base">
                {slide.body}
              </p>
              <Button
                type="button"
                onClick={() => onAction(slide)}
                className="mt-2 h-11 rounded-full bg-white px-5 text-sm font-semibold text-foreground shadow-md hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/30"
              >
                {slide.cta}
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Desktop arrows */}
        {n > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => go(safeIndex - 1, -1)}
              className="absolute left-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-foreground shadow-md backdrop-blur transition-all hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:grid md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => go(safeIndex + 1, 1)}
              className="absolute right-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-foreground shadow-md backdrop-blur transition-all hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:grid md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        )}

        {/* Dot pagination (larger hit area, Apple-minimal bars) */}
        {n > 1 && (
          <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-1">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1} of ${n}`}
                aria-current={i === safeIndex}
                onClick={() => go(i)}
                className="grid size-6 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === safeIndex
                      ? "w-6 bg-white"
                      : "w-1.5 bg-white/55 hover:bg-white/85"
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
