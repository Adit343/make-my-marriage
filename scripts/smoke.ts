// A quick check of a running copy of the app, to run right after a deploy:
//
//   npm run smoke -- https://your-domain.example
//
// It only reads public pages and sends one request that must be refused; it writes nothing.

const base = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Usage: npm run smoke -- https://your-domain.example");
  process.exit(2);
}

let failed = false;
function report(ok: boolean, label: string, detail = "") {
  if (!ok) failed = true;
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${detail ? ` (${detail})` : ""}`);
}

async function get(path: string) {
  return fetch(base + path, { redirect: "manual" });
}

async function main() {
  const live = await get("/api/v1/health");
  report(live.status === 200, "liveness /api/v1/health", String(live.status));

  const ready = await get("/api/v1/health/ready");
  const readyBody = ready.ok ? ((await ready.json()) as { data?: Record<string, unknown> }) : null;
  report(ready.status === 200, "readiness /api/v1/health/ready", String(ready.status));
  if (readyBody?.data) {
    report(readyBody.data.database === true, "database reachable");
    report(readyBody.data.photoStorage === true, "photo storage configured");
    report(readyBody.data.email === true, "email configured");
  }

  for (const path of ["/", "/login", "/signup", "/terms", "/privacy"]) {
    const response = await get(path);
    report(response.status === 200, `page ${path}`, String(response.status));
  }

  const sessions = await get("/api/v1/auth/sessions");
  report(
    sessions.status === 401,
    "private API refuses a signed-out caller",
    String(sessions.status),
  );

  const missing = await get("/w/this-site-does-not-exist-0000");
  report(missing.status === 404, "unknown wedding website is a 404", String(missing.status));

  const headers = live.headers;
  report(headers.get("x-content-type-options") === "nosniff", "header: nosniff");
  report(headers.get("x-frame-options") === "DENY", "header: frame denial");
  report(Boolean(headers.get("content-security-policy")), "header: content security policy");
  if (base.startsWith("https://")) {
    report(Boolean(headers.get("strict-transport-security")), "header: HSTS");
  }

  const cross = await fetch(`${base}/api/v1/auth/logout`, {
    method: "POST",
    headers: { origin: "https://evil.example" },
  });
  report(cross.status === 403, "cross-site write is refused", String(cross.status));
}

main()
  .catch((error: unknown) => {
    report(false, "the app could not be reached", error instanceof Error ? error.message : "");
  })
  .finally(() => {
    console.log(failed ? "\nSome checks FAILED." : "\nAll checks passed.");
    process.exitCode = failed ? 1 : 0;
  });
