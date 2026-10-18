import type { NextConfig } from "next";

/**
 * DEPLOY_TARGET=pages gera um site estático para o GitHub Pages (modo local, sem Supabase),
 * servido em /prumo. Sem a variável, o app roda como servidor Next completo.
 */
const isPages = process.env.DEPLOY_TARGET === "pages";
const basePath = isPages ? process.env.NEXT_PUBLIC_BASE_PATH ?? "/prumo" : "";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  ...(isPages
    ? {
        output: "export",
        basePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        cacheComponents: true,
        partialPrefetching: true,
        async redirects() {
          return [
            { source: "/expenses", destination: "/transactions", permanent: true },
            { source: "/expenses/:id", destination: "/transactions/detail?id=:id", permanent: true },
            { source: "/recurring", destination: "/bills", permanent: true },
            { source: "/insights", destination: "/reports", permanent: true },
          ];
        },
      }),
};

export default nextConfig;
