import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 defaults to Turbopack; keep an empty config so Vercel builds don't
  // fail when a webpack-only option is present elsewhere.
  turbopack: {},
};

export default nextConfig;
