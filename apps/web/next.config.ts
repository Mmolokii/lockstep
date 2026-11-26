import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers.ts";

const dev = process.env.NODE_ENV !== "production";
// HTTPS-only headers (upgrade-insecure-requests, HSTS) are sent only where the site is served over HTTPS.
const https = process.env.VERCEL === "1" || process.env.LOCKSTEP_HTTPS === "1";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages export TypeScript source (ADR 0002); Next compiles them.
  transpilePackages: ["@lockstep/protocol"],
  // Type errors are a CI gate on their own (`pnpm typecheck` with TypeScript 7),
  // so `next build` doesn't need to run a second, older type checker.
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ dev, https }) }];
  },
};

export default config;
