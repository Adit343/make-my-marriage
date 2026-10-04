// Best-effort client IP for rate limiting only (never stored raw — see rateLimitCounters).
// On Vercel, x-forwarded-for is set by the platform; its first entry is the client.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}
