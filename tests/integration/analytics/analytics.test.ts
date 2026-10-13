import { beforeEach, describe, expect, it } from "vitest";
import { GET as ready } from "@/app/api/v1/health/ready/route";
import { POST as createGuestRoute } from "@/app/api/v1/weddings/[weddingId]/guests/route";
import { track, summarize } from "@/modules/analytics/analytics.service";
import { AnalyticsCounter } from "@/models/analyticsCounter.model";
import { clearCollections, setupTestDatabase } from "../../setup/database";
import { signUpUser } from "../../setup/auth";
import { call } from "../../setup/http";
import { setupWedding } from "../../setup/wedding";
import { createEvent } from "../invitations/helpers-events";

setupTestDatabase();
beforeEach(clearCollections);

const total = async (event: string) =>
  (await AnalyticsCounter.find({ event }).lean()).reduce((sum, row) => sum + row.count, 0);

describe("analytics counters", () => {
  it("add up per day and per event, and summarise over a window", async () => {
    const today = new Date("2026-10-13T10:00:00Z");
    await track("signup", 1, today);
    await track("signup", 2, today);
    await track("signup", 1, new Date("2026-10-10T10:00:00Z"));
    await track("wedding_created", 1, today);
    await track("signup", 5, new Date("2026-08-01T10:00:00Z")); // outside a 7-day window

    const week = await summarize(7, today);
    expect(week.totals.signup).toBe(4);
    expect(week.totals.wedding_created).toBe(1);
    expect(week.signupToWedding).toBe(0.25);
    expect((await summarize(90, today)).totals.signup).toBe(9);
    expect(await AnalyticsCounter.countDocuments({ event: "signup", day: "2026-10-13" })).toBe(1);
  });

  it("survive concurrent first hits", async () => {
    const now = new Date("2026-10-13T10:00:00Z");
    await Promise.all(Array.from({ length: 12 }, () => track("guest_created", 1, now)));
    expect(await total("guest_created")).toBe(12);
  });

  it("ignore nothing-happened counts", async () => {
    await track("signup", 0);
    expect(await AnalyticsCounter.countDocuments({})).toBe(0);
  });

  it("are counted by the real flows and hold no personal data", async () => {
    const { weddingId, owner } = await setupWedding();
    await createEvent(weddingId, owner, { name: "Haldi" });
    const guest = await call(createGuestRoute, {
      cookie: owner.cookie,
      params: { weddingId },
      body: { name: "Rahul Sharma", side: "partnerOne" },
    });
    expect(guest.status).toBe(201);
    await signUpUser();

    expect(await total("signup")).toBe(2);
    expect(await total("wedding_created")).toBe(1);
    expect(await total("event_created")).toBe(1);
    expect(await total("guest_created")).toBe(1);

    const stored = JSON.stringify(await AnalyticsCounter.find({}).lean());
    expect(stored).not.toContain(weddingId);
    expect(stored).not.toContain("Rahul");
    expect(stored).not.toContain(owner.user.email);
  });
});

describe("GET /health/ready", () => {
  it("reports readiness with booleans only", async () => {
    const result = await call(ready, { method: "GET" });
    expect(result.status).toBe(200);
    expect(result.json.data).toEqual({
      status: "ok",
      database: true,
      photoStorage: true,
      email: expect.any(Boolean),
    });
  });
});
