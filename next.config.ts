import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework to attackers.
  poweredByHeader: false,
  // Gzip/brotli the SSR HTML and RSC payloads.
  compress: true,
  // Surface accidental double-render / effect bugs in dev.
  reactStrictMode: true,
};

export default nextConfig;
