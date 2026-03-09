import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove X-Powered-By header for security
  poweredByHeader: false,

  // Stricter React mode for catching bugs
  reactStrictMode: true,

  // Reduce logging in production
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;
