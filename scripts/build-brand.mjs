// One-off brand asset builder: converts the uploaded JPEG brand files into
// production assets (transparent logo, app icons, favicon, og image, manifest).
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const ICON_SRC = "upload/WhatsApp Image 2026-09-06 at 12.10.30 PM.jpeg"; // 1254x1254 app icon
const LOGO_SRC = "upload/WhatsApp Image 2026-09-06 at 12.10.30 PM (1).jpeg"; // 1600x800 horizontal logo

mkdirSync("public/brand", { recursive: true });

const isWhiteish = (r, g, b, minCut, satCut) => {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= minCut && max - min <= satCut;
};

// Remove white background connected to the image border (BFS flood fill),
// optionally a global pass for remaining pure-white pockets (logo letter
// counters), then feather the boundary so edges do not leave a white halo.
// NOTE: the app icon's cream house is near-pure-white but ENCLOSED by the
// green square — it must NOT go through the global pass.
function stripWhite(data, w, h, globalPass) {
  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (visited[i]) return;
    visited[i] = 1;
    const o = i * 4;
    if (isWhiteish(data[o], data[o + 1], data[o + 2], 236, 20)) stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const o = i * 4;
    data[o + 3] = 0;
    const x = i % w;
    const y = (i - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  // Enclosed pure-white pockets (e.g. letter counters in the logo)
  if (globalPass) {
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      if (data[o + 3] !== 0 && isWhiteish(data[o], data[o + 1], data[o + 2], 249, 10)) {
        data[o + 3] = 0;
      }
    }
  }
  // Feather: pixels adjacent to transparency get graded alpha (halo removal)
  const alphaSnapshot = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alphaSnapshot[i] = data[i * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      if (alphaSnapshot[i] === 0) continue;
      const nextToTransparent =
        (x > 0 && alphaSnapshot[i - 1] === 0) ||
        (x < w - 1 && alphaSnapshot[i + 1] === 0) ||
        (y > 0 && alphaSnapshot[i - w] === 0) ||
        (y < h - 1 && alphaSnapshot[i + w] === 0);
      if (!nextToTransparent) continue;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const min = Math.min(r, g, b);
      const max = Math.max(r, g, b);
      if (max - min <= 22 && min >= 200) {
        data[o + 3] = Math.max(0, Math.min(255, Math.round((244 - min) * 14)));
      }
    }
  }
}

async function makeTransparent(src, globalPass) {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  stripWhite(data, info.width, info.height, globalPass);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

const iconTransparent = await makeTransparent(ICON_SRC, false);
const logoTransparent = await makeTransparent(LOGO_SRC, true);

// App icons (transparent corners — crisp in browser tabs / web)
await iconTransparent.clone().resize(512, 512).png().toFile("src/app/icon.png");
await iconTransparent.clone().resize(512, 512).png().toFile("public/brand/icon-512.png");
await iconTransparent.clone().resize(192, 192).png().toFile("public/brand/icon-192.png");

// Apple touch icon: keep opaque white square — iOS applies its own mask
await sharp(ICON_SRC).resize(180, 180).flatten({ background: "#ffffff" }).png().toFile("src/app/apple-icon.png");
// Maskable (full-bleed opaque for Android adaptive icons)
await sharp(ICON_SRC).resize(512, 512).flatten({ background: "#ffffff" }).png().toFile("public/brand/icon-maskable-512.png");

// Horizontal logo: trim, resize to height 120, transparent bg
const logoTrimmed = await logoTransparent.clone().trim({ threshold: 12 }).png().toBuffer();
const logoMeta = await sharp(logoTrimmed).metadata();
console.log("logo trimmed size:", logoMeta.width, "x", logoMeta.height);
await sharp(logoTrimmed)
  .resize({ height: 120 })
  .png()
  .toFile("public/brand/logo.png");

// Favicon-level small logo mark (square icon at 48px)
await iconTransparent.clone().resize(48, 48).png().toFile("public/brand/icon-48.png");

// OG image 1200x630: white canvas, logo centered at ~76% width
const logoForOg = await sharp(logoTrimmed).resize({ width: 912 }).png().toBuffer();
await sharp({
  create: { width: 1200, height: 630, channels: 4, background: "#ffffff" },
})
  .composite([{ input: logoForOg, gravity: "center" }])
  .png()
  .toFile("public/brand/og.png");

// Sample brand green for theme-color (left-middle of the icon square)
const { data: sample } = await sharp(ICON_SRC)
  .extract({ left: 90, top: 627, width: 8, height: 8 })
  .raw()
  .toBuffer({ resolveWithObject: true });
const hex = (v) => v.toString(16).padStart(2, "0");
const r = sample[0], g = sample[1], b = sample[2];
console.log(`brand green sample: #${hex(r)}${hex(g)}${hex(b)}`);

// PWA manifest
const manifest = {
  name: "iShim — House Rental",
  short_name: "iShim",
  description:
    "iShim is the hyper-local rental platform for Ukhrul. Find, rent and belong.",
  start_url: "/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: `#${hex(r)}${hex(g)}${hex(b)}`,
  icons: [
    { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
writeFileSync("public/brand/manifest.webmanifest", JSON.stringify(manifest, null, 2));

console.log("done");
