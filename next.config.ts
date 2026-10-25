import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow a build into an isolated directory (NEXT_DIST_DIR=.next-prod) so a
  // production-build check never clobbers the running dev server's .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
