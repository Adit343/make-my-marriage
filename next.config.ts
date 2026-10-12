import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

// API Design §14.2 — see src/lib/security-headers.ts for what each header is for.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          development: process.env.NODE_ENV !== "production",
          // The photo store (Cloudflare R2), when configured: photos load from and upload to it.
          mediaOrigin: process.env.R2_ACCOUNT_ID
            ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
            : undefined,
        }),
      },
    ];
  },
};

export default nextConfig;
