import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

// API Design §14.2 — see src/lib/security-headers.ts for what each header is for.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({ development: process.env.NODE_ENV !== "production" }),
      },
    ];
  },
};

export default nextConfig;
