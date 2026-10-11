import { describe, expect, it } from "vitest";
import { POST as createEvent } from "@/app/api/v1/weddings/[weddingId]/events/route";
import { PATCH as patchWedding } from "@/app/api/v1/weddings/[weddingId]/route";
import { resolveSession } from "@/modules/auth/session.service";
import { getDashboard } from "@/modules/dashboard/dashboard.service";
import { getEventPage, getGuestsPage } from "@/modules/dashboard/workspace-pages.service";
import { signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { createGroup, deleteGuest, makeGuest, record } from "../guests/helpers";
import { setupWedding } from "../../setup/wedding";

setupTestDatabase();

async function authFor(cookie: string) {
  const auth = await resolveSession(cookie.split("=")[1]);
  if (!auth) throw new Error("no session");
  return auth;
}

describe("getGuestsPage", () => {
  it("gives the first page, the groups, the events as choices and the numbers", async () => {
    const { weddingId, owner } = await setupWedding();
    await call(patchWedding, {
      method: "PATCH",
      cookie: owner.cookie,
      params: { weddingId },
      body: { version: 0, partners: [{ name: "Aarav Trivedi" }, { name: "Diya" }] },
    });
    const event = (
      await call(createEvent, {
        cookie: owner.cookie,
        params: { weddingId },
        body: {
          name: "Haldi Ceremony",
          type: "haldi",
          startsAt: "2027-02-13T04:30:00Z",
          dressCode: "Traditional Yellow",
          location: { label: "Courtyard East" },
        },
      })
    ).json.data.id as string;
    const group = (await createGroup(weddingId, owner, { name: "Family", side: "both" })).json.data;
    const guest = await makeGuest(weddingId, owner, {
      name: "Rahul",
      groupId: group.id,
      plusOnesAllowed: 1,
      eventIds: [event],
    });
    await record(weddingId, guest.id, event, owner, { status: "attending", attendingCount: 2 });

    const page = await getGuestsPage(await authFor(owner.cookie));
    expect(page).not.toBeNull();
    expect(page!.weddingId).toBe(weddingId);
    expect(page!.timezone).toBe("Asia/Kolkata");
    expect(page!.partners).toEqual({ one: "Aarav", two: "Diya" });
    expect(page!.page.items.map((g) => g.name)).toEqual(["Rahul"]);
    expect(page!.page).toMatchObject({ nextCursor: null, hasMore: false });
    expect(page!.groups).toEqual([
      expect.objectContaining({ id: group.id, name: "Family", guestCount: 1 }),
    ]);
    expect(page!.events).toEqual([
      expect.objectContaining({
        id: event,
        name: "Haldi Ceremony",
        dateLabel: "13 Feb",
        detail: "Courtyard East • Traditional Yellow",
      }),
    ]);
    expect(page!.summary).toEqual({
      totalGuests: 1,
      expectedHeadcount: 2,
      unsentInvitations: 1,
      awaitingResponse: 0,
    });
    expect(page!.eventId).toBeUndefined();
  });

  it("uses an event from the address for the numbers, and ignores one from another wedding", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const mine = (
      await call(createEvent, {
        cookie: a.owner.cookie,
        params: { weddingId: a.weddingId },
        body: { name: "Mine", type: "haldi", startsAt: "2027-02-13T04:30:00Z" },
      })
    ).json.data.id as string;
    const foreign = (
      await call(createEvent, {
        cookie: b.owner.cookie,
        params: { weddingId: b.weddingId },
        body: { name: "Theirs", type: "haldi", startsAt: "2027-02-13T04:30:00Z" },
      })
    ).json.data.id as string;

    const auth = await authFor(a.owner.cookie);
    expect((await getGuestsPage(auth, { eventId: mine }))!.eventId).toBe(mine);
    expect((await getGuestsPage(auth, { eventId: foreign }))!.eventId).toBeUndefined();
    expect((await getGuestsPage(auth, { eventId: "not-an-id" }))!.eventId).toBeUndefined();
  });

  it("uses neutral side names when the wedding has no partner names", async () => {
    const { owner } = await setupWedding();
    const page = await getGuestsPage(await authFor(owner.cookie));
    expect(page!.partners).toEqual({ one: "Partner one", two: "Partner two" });
    expect(page!.events).toEqual([]);
    expect(page!.summary.totalGuests).toBe(0);
  });

  it("is null for someone with no wedding", async () => {
    const { cookie } = await signUpUser();
    expect(await getGuestsPage(await authFor(cookie))).toBeNull();
  });

  it("pages at 25 and says there is more", async () => {
    const { weddingId, owner } = await setupWedding();
    for (let i = 0; i < 27; i++) {
      await makeGuest(weddingId, owner, { name: `Guest ${String(i).padStart(2, "0")}` });
    }
    const page = await getGuestsPage(await authFor(owner.cookie));
    expect(page!.page.items).toHaveLength(25);
    expect(page!.page.hasMore).toBe(true);
    expect(page!.page.nextCursor).toEqual(expect.any(String));
    expect(page!.summary.totalGuests).toBe(27);
  });
});

describe("dashboard guest count", () => {
  it("shows the real number of guests, and none for deleted ones", async () => {
    const { weddingId, owner } = await setupWedding();
    expect((await getDashboard(await authFor(owner.cookie))).workspace!.counts.guests).toBe(0);
    await makeGuest(weddingId, owner, { name: "One" });
    const two = await makeGuest(weddingId, owner, { name: "Two" });
    expect((await getDashboard(await authFor(owner.cookie))).workspace!.counts.guests).toBe(2);
    await deleteGuest(weddingId, two.id, owner);
    expect((await getDashboard(await authFor(owner.cookie))).workspace!.counts.guests).toBe(1);
  });
});

describe("dashboard RSVP overview", () => {
  it("counts each guest once by their overall answer, with a response rate and who to chase", async () => {
    const { weddingId, owner } = await setupWedding();
    const mk = async (name: string) =>
      (
        await call(createEvent, {
          cookie: owner.cookie,
          params: { weddingId },
          body: { name, type: "other", startsAt: "2027-02-13T04:30:00Z" },
        })
      ).json.data.id as string;
    const haldi = await mk("Haldi");
    const reception = await mk("Reception");
    const both = [haldi, reception];

    const coming = await makeGuest(weddingId, owner, { name: "Coming", eventIds: both });
    const no = await makeGuest(weddingId, owner, { name: "No", eventIds: both });
    const unsure = await makeGuest(weddingId, owner, { name: "Unsure", eventIds: both });
    const silent = await makeGuest(weddingId, owner, { name: "Silent", eventIds: both });
    await makeGuest(weddingId, owner, { name: "Not invited anywhere" });

    await record(weddingId, coming.id, haldi, owner, { status: "attending" });
    await record(weddingId, coming.id, reception, owner, { status: "declined" });
    for (const id of both) await record(weddingId, no.id, id, owner, { status: "declined" });
    await record(weddingId, unsure.id, haldi, owner, { status: "maybe" });
    await record(weddingId, unsure.id, reception, owner, { status: "declined" });
    await record(weddingId, silent.id, haldi, owner, { status: "attending" });

    const { rsvp } = (await getDashboard(await authFor(owner.cookie))).workspace!;
    expect(rsvp).toMatchObject({
      invited: 4,
      attending: 2, // Coming, Silent (coming to one event is coming)
      declined: 1, // No
      pending: 1, // Unsure (maybe)
      responseRate: 75, // 3 of 4 have answered: Silent still has a pending Reception reply but is attending
      pendingTotal: 1, // Unsure is the only guest not yet confirmed
    });
    expect(rsvp.followUp).toEqual([{ id: unsure.id, name: "Unsure", waitingOn: 1 }]);
  });

  it("is empty with nobody invited", async () => {
    const { owner } = await setupWedding();
    const { rsvp } = (await getDashboard(await authFor(owner.cookie))).workspace!;
    expect(rsvp).toEqual({
      invited: 0,
      attending: 0,
      declined: 0,
      pending: 0,
      responseRate: null,
      followUp: [],
      pendingTotal: 0,
    });
  });
});

describe("the event page's replies", () => {
  it("gives the event's real counts", async () => {
    const { weddingId, owner } = await setupWedding();
    const event = (
      await call(createEvent, {
        cookie: owner.cookie,
        params: { weddingId },
        body: { name: "Haldi", type: "haldi", startsAt: "2027-02-13T04:30:00Z" },
      })
    ).json.data.id as string;
    const a = await makeGuest(weddingId, owner, {
      name: "A",
      plusOnesAllowed: 2,
      eventIds: [event],
    });
    await makeGuest(weddingId, owner, { name: "B", eventIds: [event] });
    await record(weddingId, a.id, event, owner, { status: "attending", attendingCount: 3 });

    const page = await getEventPage(await authFor(owner.cookie), event);
    if (page === "not_found" || page === null) throw new Error("no page");
    expect(page.replies).toEqual({
      eventId: event,
      byStatus: { pending: 1, attending: 1, declined: 0, maybe: 0 },
      totalAttendingCount: 3,
    });
  });
});
