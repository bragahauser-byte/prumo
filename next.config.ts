import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      { source: "/expenses", destination: "/transactions", permanent: true },
      { source: "/expenses/:id", destination: "/transactions/:id", permanent: true },
      { source: "/recurring", destination: "/bills", permanent: true },
      { source: "/insights", destination: "/reports", permanent: true },
    ];
  },
};

export default nextConfig;
