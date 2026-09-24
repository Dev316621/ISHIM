"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Photo } from "./photo";
import { cn } from "@/lib/utils";

/**
 * Full-bleed swipeable photo carousel with arrows, dots, a counter chip and
 * a click-to-expand lightbox. Used on both mobile and desktop detail views.
 */
export function PhotoCarousel({
  photos,
  title,
  aspectClassName = "aspect-[4/3] md:aspect-[16/9]",
}: {
  photos: string[];
  title: string;
  aspectClassName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const count = photos.length;

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(Math.max(0, Math.min(count - 1, i)));
  };

  const goTo = useCallback(
    (i: number) => {
      const el = trackRef.current;
      const clamped = Math.max(0, Math.min(count - 1, i));
      setIndex(clamped);
      el?.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    },
    [count]
  );

  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);

  // Keyboard navigation in the lightbox.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, prev, next]);

  if (!count) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-3xl bg-secondary",
          aspectClassName
        )}
        aria-label={`${title} — no photos yet`}
      >
        <Expand className="size-10 text-primary/30" aria-hidden />
      </div>
    );
  }

  return (
    <div>
      <div
        className={cn(
          "group relative overflow-hidden rounded-3xl bg-secondary",
          aspectClassName
        )}
      >
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto no-scrollbar"
          aria-label={`${title} photos`}
          role="group"
        >
          {photos.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setLightbox(true)}
              aria-label={`Open photo ${i + 1} of ${count} full screen`}
              className="aspect-[inherit] h-full w-full shrink-0 snap-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <Photo
                src={src}
                alt={`${title} photo ${i + 1}`}
                className="h-full w-full"
                iconClassName="size-12"
              />
            </button>
          ))}
        </div>

        {count > 1 ? (
          <>
            {/* Arrows */}
            <button
              type="button"
              onClick={prev}
              disabled={index === 0}
              aria-label="Previous photo"
              className="absolute left-2.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md backdrop-blur transition-all hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-0 md:size-11"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={next}
              disabled={index === count - 1}
              aria-label="Next photo"
              className="absolute right-2.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md backdrop-blur transition-all hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-0 md:size-11"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>

            {/* Counter chip */}
            <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              {index + 1} / {count}
            </span>

            {/* Dots */}
            <div
              className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5"
              role="tablist"
              aria-label="Photo selector"
            >
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Go to photo ${i + 1}`}
                  onClick={() => goTo(i)}
                  className={cn(
                    "h-2 min-w-2 rounded-full transition-all",
                    i === index
                      ? "w-6 bg-white"
                      : "bg-white/50 hover:bg-white/75"
                  )}
                />
              ))}
            </div>
          </>
        ) : (
          <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
            <Expand className="size-4" aria-hidden />
          </span>
        )}
      </div>

      {/* Fullscreen lightbox */}
      <Dialog open={lightbox} onOpenChange={setLightbox}>
        <DialogContent
          className="max-w-[95vw] border-0 bg-black/95 p-0 sm:max-w-4xl sm:rounded-2xl [&>button]:hidden"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{title} photos</DialogTitle>
          <div className="relative">
            <Photo
              src={photos[index]}
              alt={`${title} photo ${index + 1}`}
              className="max-h-[80vh] w-full rounded-2xl object-contain"
              iconClassName="size-14"
            />
            {count > 1 ? (
              <>
                <button
                  type="button"
                  onClick={prev}
                  disabled={index === 0}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 disabled:opacity-30"
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={index === count - 1}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 disabled:opacity-30"
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setLightbox(false)}
              aria-label="Close full screen"
              className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30"
            >
              <X className="size-4.5" aria-hidden />
            </button>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
              {index + 1} / {count}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
