import { describe, expect, it } from "vitest";
import { resolveSession } from "@/modules/auth/session.service";
import {
  getEventsPage,
  getGuestsPage,
  getInvitationsPage,
} from "@/modules/dashboard/workspace-pages.service";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import { makeEvent, makeGuest, record } from "../guests/helpers";
import { captureGuestEmails, invite } from "../invitations/helpers";

setupTestDatabase();

async function authFor(cookie: string) {
  const auth = await resolveSession(cookie.split("=")[1]);
  if (!auth) throw new Error("no session");
  return auth;
}

describe("getInvitationsPage", () => {
  it("gives the overview, the events, the first unfinished event and who may read the log", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    captureGuestEmails();
    const haldi = await makeEvent(weddingId, owner, "Haldi");
    await makeEvent(weddingId, owner, "Sangeet");
    const guest = await makeGuest(weddingId, owner, { email: "a@example.com", eventIds: [haldi] });
    await invite(weddingId, guest.id, owner, { channel: "email" });

    const ownerPage = await getInvitationsPage(await authFor(owner.cookie), { wantReplies: false });
    expect(ownerPage?.overview.totals).toMatchObject({ guests: 1, invited: 1 });
    expect(ownerPage?.events.map((event) => event.name)).toEqual(["Haldi", "Sangeet"]);
    expect(ownerPage?.canViewLog).toBe(true);
    expect(ownerPage?.replies).toBeNull();
    expect(ownerPage?.viewer.role).toBe("owner");

    const memberPage = await getInvitationsPage(await authFor(member.cookie), {
      wantReplies: false,
    });
    expect(memberPage?.canViewLog).toBe(false);
  });

  it("loads the chosen event's replies for the RSVP tab, and ignores another wedding's event", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other");
    const haldi = await makeEvent(a.weddingId, a.owner, "Haldi");
    const foreign = await makeEvent(b.weddingId, b.owner, "Foreign");
    const guest = await makeGuest(a.weddingId, a.owner, { eventIds: [haldi] });
    await record(a.weddingId, guest.id, haldi, a.owner, { status: "attending", attendingCount: 1 });

    const auth = await authFor(a.owner.cookie);
    const page = await getInvitationsPage(auth, { eventId: haldi, wantReplies: true });
    expect(page?.eventId).toBe(haldi);
    expect(page?.replies?.totalAttendingCount).toBe(1);

    const withForeign = await getInvitationsPage(auth, { eventId: foreign, wantReplies: true });
    expect(withForeign?.eventId).toBe(haldi); // fell back to this wedding's own event
    expect(JSON.stringify(withForeign)).not.toContain(foreign);
  });

  it("has no event to track in a wedding without events", async () => {
    const { owner } = await setupWedding();
    const page = await getInvitationsPage(await authFor(owner.cookie), { wantReplies: true });
    expect(page?.eventId).toBeNull();
    expect(page?.replies).toBeNull();
  });
});

describe("Guests and Events pages carry the invitation numbers", () => {
  it("tells the Guests page whether the viewer may open the delivery log", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    expect((await getGuestsPage(await authFor(owner.cookie)))?.canViewLog).toBe(true);
    expect((await getGuestsPage(await authFor(member.cookie)))?.canViewLog).toBe(false);
  });

  it("gives each event on the timeline how many guests were invited and replied", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await makeEvent(weddingId, owner, "Haldi");
    const sangeet = await makeEvent(weddingId, owner, "Sangeet");
    const rahul = await makeGuest(weddingId, owner, {
      name: "Rahul",
      plusOnesAllowed: 1,
      eventIds: [haldi],
    });
    await makeGuest(weddingId, owner, { name: "Meera", eventIds: [haldi] });
    await record(weddingId, rahul.id, haldi, owner, { status: "attending", attendingCount: 2 });

    const page = await getEventsPage(await authFor(owner.cookie));
    expect(page?.guestNumbers[haldi]).toEqual({ invited: 2, replied: 1, attendingPeople: 2 });
    expect(page?.guestNumbers[sangeet]).toBeUndefined();
  });
});
