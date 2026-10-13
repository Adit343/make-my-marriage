import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

// Shared helpers for the browser tests. Accounts and data are made through the same REST API the
// screens use (fast and exact); the checks then look at the real pages in a real browser.

let counter = 0;
export const PASSWORD = "correct-horse-battery";

/** Each context gets its own client address so the per-IP signup limit never trips. */
export function freshIp() {
  counter += 1;
  return `10.${Math.floor(Math.random() * 200)}.${Math.floor(counter / 250)}.${(counter % 250) + 1}`;
}

export async function newVisitor(browser: Browser) {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
  return { context, page: await context.newPage() };
}

async function ok<T>(response: APIResponse): Promise<T> {
  const body = await response.json();
  if (!response.ok()) {
    throw new Error(`${response.url()} -> ${response.status()} ${JSON.stringify(body)}`);
  }
  return body.data as T;
}

export async function signUp(request: APIRequestContext, name = "Priya Sharma") {
  const email = `e2e${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`;
  await ok(
    await request.post("/api/v1/auth/signup", { data: { email, password: PASSWORD, name } }),
  );
  return { email };
}

/** A signed-in owner with a wedding, one event, one guest invited to it, and one task. */
export async function seedWedding(context: BrowserContext) {
  const request = context.request;
  const { email } = await signUp(request);
  const created = await ok<{ wedding: { id: string } }>(
    await request.post("/api/v1/weddings", {
      data: {
        title: "Aarav & Diya's Wedding",
        partners: [{ name: "Aarav" }, { name: "Diya" }],
        weddingDate: "2027-02-14",
        relationship: "couple",
      },
    }),
  );
  const weddingId = created.wedding.id;
  const base = `/api/v1/weddings/${weddingId}`;
  const event = await ok<{ id: string }>(
    await request.post(`${base}/events`, {
      data: {
        name: "Haldi",
        type: "haldi",
        startsAt: "2027-02-13T04:30:00Z",
        isPublic: true,
        location: { label: "Family Home" },
      },
    }),
  );
  const guest = await ok<{ id: string }>(
    await request.post(`${base}/guests`, {
      data: { name: "Rahul Sharma", side: "partnerOne", plusOnesAllowed: 1, eventIds: [event.id] },
    }),
  );
  const link = await ok<{ inviteUrl: string }>(
    await request.post(`${base}/guests/${guest.id}/link`, { data: {} }),
  );
  await ok(
    await request.post(`${base}/tasks`, {
      data: { title: "Book the decorator", priority: "high" },
    }),
  );
  return { email, weddingId, eventId: event.id, guestId: guest.id, inviteUrl: link.inviteUrl };
}

/** Fails with a readable list if axe finds any WCAG A/AA problem on the page as it is now. */
export async function expectNoA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes.length} element(s), e.g. ${v.nodes[0]?.target.join(" ")}`,
  );
  expect(summary, `Accessibility problems on ${label}`).toEqual([]);
}

/** No horizontal scrolling: the page is never wider than the screen. */
export async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} scrolls sideways`).toBeLessThanOrEqual(1);
}
