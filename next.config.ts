import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow a build into an isolated directory (NEXT_DIST_DIR=.next-prod) so a
  // production-build check never clobbers the running dev server's .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Prisma's generated client ships runtime-specific files (workerd vs Node) —
  // keep it external so the Cloudflare/OpenNext build bundles it correctly.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // Photos render via plain <img> — no next/image optimizer needed.
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
