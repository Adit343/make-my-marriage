import { describe, expect, it } from "vitest";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import { createGroup, deleteGroup, getGuest, listGroups, makeGuest, patchGroup } from "./helpers";

setupTestDatabase();

async function makeGroup(
  weddingId: string,
  who: Parameters<typeof createGroup>[1],
  name = "Sharma Family",
) {
  const result = await createGroup(weddingId, who, { name, side: "partnerOne" });
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data as { id: string; version: number };
}

describe("guest groups", () => {
  it("creates a group and lists it with its guest count", async () => {
    const { weddingId, owner } = await setupWedding();
    const group = await makeGroup(weddingId, owner);
    await makeGuest(weddingId, owner, { name: "Rahul", groupId: group.id });
    await makeGuest(weddingId, owner, { name: "Meera", groupId: group.id });
    await makeGuest(weddingId, owner, { name: "Karan" });

    const result = await listGroups(weddingId, owner);
    expect(result.status).toBe(200);
    expect(result.json.data).toEqual([
      expect.objectContaining({ name: "Sharma Family", side: "partnerOne", guestCount: 2 }),
    ]);
  });

  it("lists groups A to Z", async () => {
    const { weddingId, owner } = await setupWedding();
    await makeGroup(weddingId, owner, "Work Colleagues");
    await makeGroup(weddingId, owner, "College Friends");
    const result = await listGroups(weddingId, owner);
    expect(result.json.data.map((g: { name: string }) => g.name)).toEqual([
      "College Friends",
      "Work Colleagues",
    ]);
  });

  it("refuses a second group with the same name, ignoring case and spacing", async () => {
    const { weddingId, owner } = await setupWedding();
    await makeGroup(weddingId, owner, "Sharma Family");
    const again = await createGroup(weddingId, owner, { name: "  sharma   FAMILY ", side: "both" });
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe("CONFLICT");
  });

  it("lets another wedding use the same name", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    await makeGroup(a.weddingId, a.owner, "Sharma Family");
    const result = await createGroup(b.weddingId, b.owner, { name: "Sharma Family", side: "both" });
    expect(result.status).toBe(201);
  });

  it("lets a deleted group's name be used again", async () => {
    const { weddingId, owner } = await setupWedding();
    const group = await makeGroup(weddingId, owner);
    const removed = await deleteGroup(weddingId, group.id, owner, { reassignTo: null });
    expect(removed.status).toBe(200);
    expect(
      (await createGroup(weddingId, owner, { name: "Sharma Family", side: "both" })).status,
    ).toBe(201);
  });

  it("validates the body", async () => {
    const { weddingId, owner } = await setupWedding();
    expect((await createGroup(weddingId, owner, { name: "", side: "both" })).status).toBe(400);
    expect((await createGroup(weddingId, owner, { name: "x", side: "left" })).status).toBe(400);
    expect((await createGroup(weddingId, owner, { name: "x" })).status).toBe(400);
    expect(
      (await createGroup(weddingId, owner, { name: "x", side: "both", extra: 1 })).status,
    ).toBe(400);
  });

  it("lets every role manage groups", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const group = await makeGroup(weddingId, member, "Made by a member");
    const renamed = await patchGroup(weddingId, group.id, owner, {
      version: group.version,
      name: "Renamed by the owner",
    });
    expect(renamed.status).toBe(200);
    expect(renamed.json.data.name).toBe("Renamed by the owner");
  });

  it("renames, changes side and clears notes, and rejects a stale version", async () => {
    const { weddingId, owner } = await setupWedding();
    const group = await makeGroup(weddingId, owner);
    const first = await patchGroup(weddingId, group.id, owner, {
      version: group.version,
      side: "both",
      notes: "Close family",
    });
    expect(first.status).toBe(200);
    expect(first.json.data).toMatchObject({ side: "both", notes: "Close family" });

    const stale = await patchGroup(weddingId, group.id, owner, {
      version: group.version,
      name: "Stale",
    });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("VERSION_CONFLICT");

    const cleared = await patchGroup(weddingId, group.id, owner, {
      version: first.json.data.version,
      notes: null,
    });
    expect(cleared.json.data.notes).toBeNull();
  });

  it("refuses renaming a group to another group's name", async () => {
    const { weddingId, owner } = await setupWedding();
    await makeGroup(weddingId, owner, "College Friends");
    const group = await makeGroup(weddingId, owner, "Work Colleagues");
    const result = await patchGroup(weddingId, group.id, owner, {
      version: group.version,
      name: "college friends",
    });
    expect(result.status).toBe(409);
  });

  describe("deleting", () => {
    it("needs to be told where the guests go", async () => {
      const { weddingId, owner } = await setupWedding();
      const group = await makeGroup(weddingId, owner);
      const result = await deleteGroup(weddingId, group.id, owner, {});
      expect(result.status).toBe(400);
    });

    it("leaves the guests ungrouped when reassignTo is null", async () => {
      const { weddingId, owner } = await setupWedding();
      const group = await makeGroup(weddingId, owner);
      const guest = await makeGuest(weddingId, owner, { groupId: group.id });
      const result = await deleteGroup(weddingId, group.id, owner, { reassignTo: null });
      expect(result.status).toBe(200);
      expect(result.json.data).toMatchObject({ id: group.id, guestsMoved: 1 });
      expect((await getGuest(weddingId, guest.id, owner)).json.data.groupId).toBeNull();
      expect((await listGroups(weddingId, owner)).json.data).toEqual([]);
    });

    it("moves the guests to another group", async () => {
      const { weddingId, owner } = await setupWedding();
      const from = await makeGroup(weddingId, owner, "From");
      const to = await makeGroup(weddingId, owner, "To");
      const guest = await makeGuest(weddingId, owner, { groupId: from.id });
      const result = await deleteGroup(weddingId, from.id, owner, { reassignTo: to.id });
      expect(result.json.data.guestsMoved).toBe(1);
      expect((await getGuest(weddingId, guest.id, owner)).json.data.groupId).toBe(to.id);
      expect((await listGroups(weddingId, owner)).json.data).toEqual([
        expect.objectContaining({ id: to.id, guestCount: 1 }),
      ]);
    });

    it("refuses moving the guests into the group being deleted", async () => {
      const { weddingId, owner } = await setupWedding();
      const group = await makeGroup(weddingId, owner);
      const result = await deleteGroup(weddingId, group.id, owner, { reassignTo: group.id });
      expect(result.status).toBe(422);
    });

    it("refuses a destination group that is not in this wedding", async () => {
      const a = await setupWedding();
      const b = await setupWedding("Other wedding");
      const group = await makeGroup(a.weddingId, a.owner);
      const foreign = await makeGroup(b.weddingId, b.owner, "Foreign");
      const guest = await makeGuest(a.weddingId, a.owner, { groupId: group.id });
      const result = await deleteGroup(a.weddingId, group.id, a.owner, { reassignTo: foreign.id });
      expect(result.status).toBe(404);
      // Nothing happened: the group still exists and the guest is still in it.
      expect((await getGuest(a.weddingId, guest.id, a.owner)).json.data.groupId).toBe(group.id);
    });

    it("answers 404 for a group that is already deleted", async () => {
      const { weddingId, owner } = await setupWedding();
      const group = await makeGroup(weddingId, owner);
      await deleteGroup(weddingId, group.id, owner, { reassignTo: null });
      expect((await deleteGroup(weddingId, group.id, owner, { reassignTo: null })).status).toBe(
        404,
      );
    });
  });

  describe("wedding isolation", () => {
    it("denies someone who is not a member of the wedding", async () => {
      const a = await setupWedding();
      const b = await setupWedding("Other wedding");
      expect((await listGroups(a.weddingId, b.owner)).status).toBe(403);
      expect((await createGroup(a.weddingId, b.owner, { name: "x", side: "both" })).status).toBe(
        403,
      );
    });

    it("answers 404 for another wedding's group id, not 403", async () => {
      const a = await setupWedding();
      const b = await setupWedding("Other wedding");
      const group = await makeGroup(a.weddingId, a.owner);
      const patch = await patchGroup(b.weddingId, group.id, b.owner, {
        version: 0,
        name: "Hijacked",
      });
      expect(patch.status).toBe(404);
      expect((await deleteGroup(b.weddingId, group.id, b.owner, { reassignTo: null })).status).toBe(
        404,
      );
      expect((await listGroups(a.weddingId, a.owner)).json.data[0].name).toBe("Sharma Family");
    });

    it("requires a session", async () => {
      const { weddingId } = await setupWedding();
      const result = await createGroup(weddingId, { cookie: "" } as never, {
        name: "x",
        side: "both",
      });
      expect(result.status).toBe(401);
    });
  });
});
