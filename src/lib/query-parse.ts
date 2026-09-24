/**
 * ─── iShim Query Parser (isomorphic) ─────────────────────────────────
 * Turns natural search phrases into structured filters, Google-engine style:
 *
 *   "2 bhk under 5000 in dungrei available" →
 *   { bedrooms: 2, maxRent: 5000, nearBlock: "dungrei", availability: true }
 *
 * Used by BOTH the suggest API (to show smart filter rows) and the client
 * (to apply filters when running the query), so the two never drift.
 */

export interface ParsedQuery {
  /** Remaining text after structured parts were extracted (search keyword). */
  tokens: string;
  minRent?: number;
  maxRent?: number;
  bedrooms?: number;
  /** Query contains availability words ("available", "vacant", "ready to move"…). */
  availability: boolean;
  /** Raw block text after "near …" (resolved to a real block by the caller). */
  nearText?: string;
  /** Human-readable chips for the UI, e.g. ["Under ₹5,000", "2 BHK"]. */
  parts: string[];
}

/** Rupee amount regex body: 5,000 / 5000 / 5k / 5.5k */
const AMT = String.raw`(?:₹\s*)?(\d[\d,]*(?:\.\d+)?\s*k?)`;

function parseAmount(raw: string): number | undefined {
  const m = raw.toLowerCase().replace(/,/g, "").trim().match(/^(\d+(?:\.\d+)?)\s*(k)?$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(m[2] ? n * 1000 : n);
}

/** Strip a matched slice + collapse leftover whitespace. */
function cut(source: string, from: number, to: number): string {
  return (source.slice(0, from) + " " + source.slice(to)).replace(/\s+/g, " ").trim();
}

/**
 * Parse a raw query string into structured filters + leftover tokens.
 * Never throws; unknown text passes through as `tokens`.
 */
export function parseQuery(raw: string): ParsedQuery {
  const original = (raw ?? "").trim();
  let work = original.toLowerCase().replace(/\s+/g, " ");
  const parts: string[] = [];
  const out: ParsedQuery = { tokens: original, availability: false, parts };

  // ── Price ranges: "5000-8000", "5000 to 8000" ──
  const range = work.match(new RegExp(String.raw`\b${AMT}\s*(?:-|to|–)\s*${AMT}\b`));
  if (range && range.index !== undefined) {
    const lo = parseAmount(range[1]);
    const hi = parseAmount(range[3]);
    if (lo && hi && lo < hi) {
      out.minRent = lo;
      out.maxRent = hi;
      parts.push(`₹${lo.toLocaleString("en-IN")}–₹${hi.toLocaleString("en-IN")}`);
      work = cut(work, range.index, range.index + range[0].length);
    }
  }

  // ── Ceilings: "under 5000", "below 5k", "up to ₹6,000" … ──
  if (out.maxRent === undefined) {
    const under = work.match(
      new RegExp(
        String.raw`\b(?:under|below|less than|cheaper than|upto|up to|within|max(?:imum)?)\s*${AMT}\b`
      )
    );
    if (under && under.index !== undefined) {
      const hi = parseAmount(under[1]);
      if (hi) {
        out.maxRent = hi;
        parts.push(`Under ₹${hi.toLocaleString("en-IN")}`);
        work = cut(work, under.index, under.index + under[0].length);
      }
    }
  }

  // ── Floors: "above 3000", "over 3k", "more than ₹4,000" … ──
  if (out.minRent === undefined) {
    const above = work.match(
      new RegExp(String.raw`\b(?:above|over|more than|at least|starting(?: from)?)\s*${AMT}\b`)
    );
    if (above && above.index !== undefined) {
      const lo = parseAmount(above[1]);
      if (lo) {
        out.minRent = lo;
        parts.push(`Above ₹${lo.toLocaleString("en-IN")}`);
        work = cut(work, above.index, above.index + above[0].length);
      }
    }
  }

  // ── Bare price: "₹5000" / "around 4000" (3–6 digits, not a phone) ──
  if (out.maxRent === undefined && out.minRent === undefined) {
    const bare = work.match(new RegExp(String.raw`\b(?:₹\s*|around\s*|about\s*|rs\.?\s*)${AMT}\b`));
    if (bare && bare.index !== undefined) {
      const v = parseAmount(bare[1]);
      if (v && v >= 100 && v <= 10_000_000) {
        out.maxRent = v;
        parts.push(`Up to ₹${v.toLocaleString("en-IN")}`);
        work = cut(work, bare.index, bare.index + bare[0].length);
      }
    }
  }

  // ── Bedrooms: "2 bhk", "3 bedrooms", "2 bed room" ──
  const bed = work.match(/\b(\d{1})\s*(?:bhk|b\.h\.k|bedrooms?|bed\s+rooms?)\b/);
  if (bed && bed.index !== undefined) {
    const n = Number(bed[1]);
    if (n >= 1 && n <= 9) {
      out.bedrooms = n;
      parts.push(`${n} BHK${n > 1 ? "+" : ""}`);
      work = cut(work, bed.index, bed.index + bed[0].length);
    }
  }

  // ── Availability: "available", "vacant", "ready to move", "immediately" ──
  const avail = work.match(
    /\b(available|vacant|vacancy|ready to move|move in ready|immediately|available now|for rent now)\b/
  );
  if (avail && avail.index !== undefined) {
    out.availability = true;
    parts.push("Available now");
    work = cut(work, avail.index, avail.index + avail[0].length);
  }

  // ── Proximity: "near dungrei", "close to viewland", "nearby halisahar" ──
  const near = work.match(/\b(?:near|nearby|close to|around)\s+([a-z][a-z\s]{1,28}?)(?=\s*$|\s+(?:under|below|above|over|available|vacant|with|for|in\b))/);
  if (near && near.index !== undefined) {
    const text = near[1].trim();
    if (text) {
      out.nearText = text;
      parts.push(`Near ${text.replace(/\b\w/g, (c) => c.toUpperCase())}`);
      work = cut(work, near.index, near.index + near[0].length);
    }
  }

  const tokens = work.replace(/\s+/g, " ").trim();
  out.tokens = tokens || (parts.length > 0 ? "" : original);
  return out;
}

/** Join parsed parts for display: "Under ₹5,000 · 2 BHK". */
export function describeParsed(p: ParsedQuery): string {
  return p.parts.join(" · ");
}
