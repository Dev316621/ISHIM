/**
 * ─── Ukhrul town block proximity (isomorphic) ────────────────────────
 * Hyper-local "nearest" support for the search engine. Blocks are
 * admin-configurable; this map covers the canonical Ukhrul town wards and
 * gracefully degrades for custom blocks (falls back to the settings order).
 *
 * Each list is ordered nearest-first. It does not need to be survey-grade —
 * it only powers ranking ("Near Dungrei → Phungwamee, Mini Veng …").
 */

const NEAR_BLOCKS: Record<string, string[]> = {
  Hungpung: [
    "Halisahar", "Viewland", "Mini Veng", "Old Bazaar", "Phungyo",
    "Phungwamee", "TNL Ward", "Nungshang", "Dungrei",
  ],
  Viewland: [
    "Hungpung", "Halisahar", "Old Bazaar", "Mini Veng", "Phungyo",
    "Phungwamee", "TNL Ward", "Nungshang", "Dungrei",
  ],
  Phungyo: [
    "Old Bazaar", "TNL Ward", "Mini Veng", "Phungwamee", "Nungshang",
    "Halisahar", "Dungrei", "Viewland", "Hungpung",
  ],
  Phungwamee: [
    "Mini Veng", "Dungrei", "Phungyo", "TNL Ward", "Old Bazaar",
    "Nungshang", "Halisahar", "Viewland", "Hungpung",
  ],
  "Mini Veng": [
    "Phungwamee", "Phungyo", "TNL Ward", "Dungrei", "Old Bazaar",
    "Nungshang", "Halisahar", "Viewland", "Hungpung",
  ],
  Halisahar: [
    "Hungpung", "Viewland", "Old Bazaar", "Mini Veng", "Phungyo",
    "Phungwamee", "TNL Ward", "Nungshang", "Dungrei",
  ],
  Dungrei: [
    "Phungwamee", "Mini Veng", "TNL Ward", "Phungyo", "Nungshang",
    "Old Bazaar", "Halisahar", "Viewland", "Hungpung",
  ],
  "Old Bazaar": [
    "Phungyo", "TNL Ward", "Mini Veng", "Halisahar", "Phungwamee",
    "Nungshang", "Dungrei", "Viewland", "Hungpung",
  ],
  "TNL Ward": [
    "Old Bazaar", "Phungyo", "Mini Veng", "Phungwamee", "Dungrei",
    "Nungshang", "Halisahar", "Viewland", "Hungpung",
  ],
  Nungshang: [
    "Phungyo", "TNL Ward", "Old Bazaar", "Mini Veng", "Dungrei",
    "Phungwamee", "Halisahar", "Viewland", "Hungpung",
  ],
};

/** Case-insensitive lookup of a canonical block name, if it matches. */
export function findBlock(query: string, blocks: string[]): string | undefined {
  const needle = query.trim().toLowerCase();
  if (!needle) return undefined;
  return blocks.find((b) => b.toLowerCase() === needle)
    ?? blocks.find((b) => b.toLowerCase().includes(needle));
}

/**
 * Blocks nearest to `block`, ordered nearest-first, constrained to the
 * caller's block list. Unknown/custom blocks → the rest in settings order.
 */
export function nearestBlocks(block: string, blocks: string[]): string[] {
  const rest = blocks.filter((b) => b.toLowerCase() !== block.toLowerCase());
  const known = NEAR_BLOCKS[block];
  if (!known) return rest;
  const ranked = known.filter((b) => rest.some((r) => r.toLowerCase() === b.toLowerCase()));
  // Append any custom blocks the map doesn't know about, in settings order.
  const extras = rest.filter((r) => !known.some((k) => k.toLowerCase() === r.toLowerCase()));
  return [...ranked, ...extras];
}
