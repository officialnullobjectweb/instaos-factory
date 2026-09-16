import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* The PNG renderer ships a native binary per platform; bundling it breaks
     the dlopen. Treat it as external so it's required at runtime. */
  serverExternalPackages: ["@resvg/resvg-js"],
  reactStrictMode: true,

  // Pinned to this package so a parent-directory lockfile cannot shift the root.
  outputFileTracingRoot: path.join(process.cwd()),

  /* Runtime assets the file tracer cannot follow. The renderer reads fonts and
     the world map through variables built with path.join, which static analysis
     cannot see — without this the deployed function ships without them and the
     first render 500s. Seeds are NOT here: they are imported in
     lib/storage/seeds.ts, which is stronger than any tracing glob. */
  outputFileTracingIncludes: {
    "/api/**": ["./src/design/fonts/**", "./src/design/data/world-110m.json.gz"],
  },

  images: {
    // Brand marks are inline SVG assets served from /public.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    formats: ["image/avif", "image/webp"],
    // Ready for the Instagram integration: media comes from the CDN.
    remotePatterns: [
      { protocol: "https", hostname: "scontent.cdninstagram.com" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
    ],
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "date-fns"],
  },
};

export default nextConfig;
