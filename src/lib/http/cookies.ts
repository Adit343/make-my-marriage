// Minimal cookie parsing/serialization for route handlers, kept independent of next/headers so
// handlers stay plain Request → Response functions (and testable as such).

export interface CookieToSet {
  name: string;
  value: string;
  /** Seconds. Omit for a browser-session cookie; 0 deletes the cookie. */
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function serializeCookie(cookie: CookieToSet): string {
  const parts = [`${cookie.name}=${encodeURIComponent(cookie.value)}`];
  parts.push(`Path=${cookie.path ?? "/"}`);
  if (cookie.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(cookie.maxAge))}`);
    if (cookie.maxAge <= 0) parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  }
  if (cookie.httpOnly ?? true) parts.push("HttpOnly");
  if (cookie.secure) parts.push("Secure");
  parts.push(`SameSite=${cookie.sameSite ?? "Lax"}`);
  return parts.join("; ");
}
