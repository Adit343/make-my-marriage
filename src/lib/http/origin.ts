import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

// Extra CSRF insurance on top of SameSite=Lax (API Design §2.9; Phase 7 step 7.2). A browser
// always sends an Origin header on cross-site writes; if it is present on a state-changing request
// it must be this site. Requests with no Origin (server-to-server calls, tests, some old browsers)
// are left to the SameSite cookie rule, exactly as before.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function assertSameOrigin(request: Request, appUrl?: string | null): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;
  const origin = request.headers.get("origin");
  if (origin === null) return;

  const allowed = new Set<string>([new URL(request.url).origin]);
  const configured = appUrl === undefined ? getEnv().APP_URL : appUrl;
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      // A bad APP_URL is caught by env validation; ignore here.
    }
  }
  if (!allowed.has(origin)) {
    throw new AppError("INSUFFICIENT_ROLE", { message: "Cross-site request refused" });
  }
}
