import { describe, expect, it } from "vitest";
import { POST as createEvent } from "@/app/api/v1/weddings/[weddingId]/events/route";
import { DELETE as deleteEvent } from "@/app/api/v1/weddings/[weddingId]/events/[eventId]/route";
import { resolveSession } from "@/modules/auth/session.service";
import { getDashboard } from "@/modules/dashboard/dashboard.service";
import { getEventPage, getEventsPage } from "@/modules/dashboard/workspace-pages.service";
import { signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { addMember, setupWedding, type TestMember } from "../../setup/wedding";

setupTestDatabase();

async function authFor(cookie: string) {
  const auth = await resolveSession(cookie.split("=")[1]);
  if (!auth) throw new Error("no session");
  return auth;
}

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number, hours = 0) => new Date(Date.now() + days * DAY + hours * 3_600_000);

async function addEvent(
  weddingId: string,
  who: TestMember,
  body: Record<string, unknown>,
): Promise<string> {
  const result = await call(createEvent, { cookie: who.cookie, params: { weddingId }, body });
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data.id;
}

describe("getEventsPage", () => {
  it("gives the timeline in order, flags the next event, and counts them", async () => {
    const { weddingId, owner } = await setupWedding();
    await addEvent(weddingId, owner, {
      name: "Reception",
      type: "reception",
      startsAt: inDays(12).toISOString(),
    });
    await addEvent(weddingId, owner, {
      name: "Mehendi",
      type: "mehendi",
      startsAt: inDays(10).toISOString(),
      endsAt: inDays(10, 4).toISOString(),
      location: { label: "The Courtyard", address: { line1: "Dumas Road", city: "Surat" } },
      dressCode: "Pastels",
    });
    await addEvent(weddingId, owner, {
      name: "Engagement",
      type: "engagement",
      startsAt: inDays(-5).toISOString(),
    });

    const page = await getEventsPage(await authFor(owner.cookie));
    expect(page?.events.map((e) => e.name)).toEqual(["Engagement", "Mehendi", "Reception"]);
    expect(page?.events.map((e) => e.isUpNext)).toEqual([false, true, false]);
    expect(page?.summary.count).toBe(3);
    expect(page?.summary.next).toEqual({ text: "Next event in ", strong: "10 days" });
    expect(page?.canCreate).toBe(true);
    expect(page?.weddingTimezone).toBe("Asia/Kolkata");

    const mehendi = page!.events[1]!;
    expect(mehendi).toMatchObject({
      typeLabel: "Mehendi",
      venue: "The Courtyard, Dumas Road, Surat",
      dressCode: "Pastels",
    });
    expect(mehendi.timeRange).toMatch(/^\d\d:\d\d [AP]M – \d\d:\d\d [AP]M IST$/);
    expect(mehendi.dateBlock.monthYear).toMatch(/^[A-Z]{3} \d{4}$/);
  });

  it("works for every role, and tells each viewer which events they may change", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    await addEvent(weddingId, owner, {
      name: "Owner's event",
      type: "haldi",
      startsAt: inDays(3).toISOString(),
    });
    await addEvent(weddingId, member, {
      name: "Member's event",
      type: "sangeet",
      startsAt: inDays(4).toISOString(),
    });

    const asMember = await getEventsPage(await authFor(member.cookie));
    expect(asMember?.canCreate).toBe(true);
    expect(asMember?.events.map((e) => [e.name, e.canManage])).toEqual([
      ["Owner's event", false],
      ["Member's event", true],
    ]);
    const asOwner = await getEventsPage(await authFor(owner.cookie));
    expect(asOwner?.events.every((e) => e.canManage)).toBe(true);
  });

  it("is an empty timeline for a new wedding and null for someone with no wedding", async () => {
    const { owner } = await setupWedding();
    const page = await getEventsPage(await authFor(owner.cookie));
    expect(page?.events).toEqual([]);
    expect(page?.summary).toEqual({ count: 0, next: { text: "", strong: "No events yet" } });

    const { cookie } = await signUpUser();
    expect(await getEventsPage(await authFor(cookie))).toBeNull();
  });

  it("never shows another wedding's events", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Another wedding");
    await addEvent(a.weddingId, a.owner, {
      name: "Wedding A only",
      type: "haldi",
      startsAt: inDays(3).toISOString(),
    });
    const page = await getEventsPage(await authFor(b.owner.cookie));
    expect(page?.events).toEqual([]);
  });
});

describe("getEventPage", () => {
  it("builds the detail view with the labels the screen shows", async () => {
    const { weddingId, owner } = await setupWedding();
    // 10:00–13:00 IST on 13 Feb 2027
    const id = await addEvent(weddingId, owner, {
      name: "Haldi",
      type: "haldi",
      startsAt: "2027-02-13T04:30:00Z",
      endsAt: "2027-02-13T07:30:00Z",
      location: {
        label: "Family Home",
        address: { line1: "14 Bungalow Road, Piplod", city: "Surat", state: "Gujarat" },
      },
      description: "A morning of turmeric blessings.",
      isPublic: true,
    });

    const page = await getEventPage(await authFor(owner.cookie), id);
    if (!page || page === "not_found") throw new Error("expected the event page");
    expect(page.event).toMatchObject({
      name: "Haldi",
      longDate: "Saturday, 13 February 2027",
      detailTimeRange: "10:00 AM – 1:00 PM IST",
      duration: "3 Hours",
      venueName: "Family Home",
      address: "14 Bungalow Road, Piplod, Surat, Gujarat",
      isPublic: true,
      description: "A morning of turmeric blessings.",
      canManage: true,
      coordinates: null,
    });
    expect(page.event.mapsUrl).toContain("https://www.google.com/maps/search/");
  });

  it("answers not_found for another wedding's event, a deleted event and a missing id", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Another wedding");
    const id = await addEvent(a.weddingId, a.owner, {
      name: "Private",
      type: "haldi",
      startsAt: inDays(3).toISOString(),
    });

    expect(await getEventPage(await authFor(b.owner.cookie), id)).toBe("not_found");

    await call(deleteEvent, {
      method: "DELETE",
      cookie: a.owner.cookie,
      params: { weddingId: a.weddingId, eventId: id },
    });
    expect(await getEventPage(await authFor(a.owner.cookie), id)).toBe("not_found");
    expect(await getEventPage(await authFor(a.owner.cookie), "a".repeat(24))).toBe("not_found");
  });
});

describe("dashboard", () => {
  it("counts events and shows the next one that hasn't finished", async () => {
    const { weddingId, owner } = await setupWedding();
    const before = await getDashboard(await authFor(owner.cookie));
    expect(before.workspace?.counts.events).toBe(0);
    expect(before.workspace?.nextEvent).toBeNull();

    await addEvent(weddingId, owner, {
      name: "Engagement",
      type: "engagement",
      startsAt: inDays(-5).toISOString(),
      endsAt: inDays(-5, 3).toISOString(),
    });
    const onlyPast = await getDashboard(await authFor(owner.cookie));
    expect(onlyPast.workspace?.counts.events).toBe(1);
    expect(onlyPast.workspace?.nextEvent).toBeNull();

    const sangeetId = await addEvent(weddingId, owner, {
      name: "Sangeet",
      type: "sangeet",
      startsAt: inDays(5).toISOString(),
      location: { label: "Grand Ballroom" },
    });
    await addEvent(weddingId, owner, {
      name: "Reception",
      type: "reception",
      startsAt: inDays(8).toISOString(),
    });

    const after = await getDashboard(await authFor(owner.cookie));
    expect(after.workspace?.counts.events).toBe(3);
    expect(after.workspace?.nextEvent).toMatchObject({
      id: sangeetId,
      name: "Sangeet",
      venue: "Grand Ballroom",
    });
    // The day count follows the event's own calendar date, so it is 4 to 6 days from "now".
    expect(after.workspace?.nextEvent?.daysUntil).toBeGreaterThanOrEqual(4);
    expect(after.workspace?.nextEvent?.daysUntil).toBeLessThanOrEqual(6);
  });

  it("does not count deleted events", async () => {
    const { weddingId, owner } = await setupWedding();
    const id = await addEvent(weddingId, owner, {
      name: "Sangeet",
      type: "sangeet",
      startsAt: inDays(5).toISOString(),
    });
    await call(deleteEvent, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId, eventId: id },
    });
    const dashboard = await getDashboard(await authFor(owner.cookie));
    expect(dashboard.workspace?.counts.events).toBe(0);
    expect(dashboard.workspace?.nextEvent).toBeNull();
  });
});
