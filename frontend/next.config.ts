import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg.wasm loads core via CDN blob URLs; keep webpack from trying to polyfill Node APIs.
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
