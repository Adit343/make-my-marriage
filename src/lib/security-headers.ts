// Security headers for every response (API Design §14.2, Architecture §39). Kept out of
// next.config.ts so they can be unit-tested.
//
// Content-Security-Policy: the app loads exactly one third party — Google Fonts (a stylesheet from
// fonts.googleapis.com and font files from fonts.gstatic.com). Everything else is same-origin.
//
// Scripts need 'unsafe-inline' because Next.js emits inline bootstrap scripts; a nonce-based policy
// would need a request proxy and would make every page dynamic. Even so, this policy blocks
// third-party scripts, framing, <base> hijacking, plugin content and off-site form posts. In
// development 'unsafe-eval' and websockets are allowed for hot reload only.
//
// Live streams (Phase 5): the guest watch page embeds the YouTube or Vimeo player, so frame-src
// allows exactly those player origins and nothing else (YouTube through its no-cookie domain).
// Phase 6 (gallery) must add the CloudFront media origin to img-src / media-src.

export interface HeaderEntry {
  key: string;
  value: string;
}

export function contentSecurityPolicy(options: { development: boolean }): string {
  const { development } = options;
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    "img-src": ["'self'", "data:", "blob:"],
    "frame-src": [
      "https://www.youtube-nocookie.com",
      "https://player.vimeo.com",
      "https://vimeo.com",
    ],
    "connect-src": ["'self'", ...(development ? ["ws:", "wss:"] : [])],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!development) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders(options: { development: boolean }): HeaderEntry[] {
  return [
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    // The app uses none of these browser features; deny them so injected code can't either.
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
