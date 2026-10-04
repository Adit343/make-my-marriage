import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { POST as createWedding } from "@/app/api/v1/weddings/route";
import { User } from "@/models/user.model";
import { WeddingMember } from "@/models/weddingMember.model";
import { getDashboard, initialsOf } from "@/modules/dashboard/dashboard.service";
import { signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";

setupTestDatabase();

function authFor(user: { id: string; email: string; name: string }) {
  return { userId: user.id, sessionId: new Types.ObjectId().toString(), user };
}

describe("getDashboard()", () => {
  it("returns no workspace for an account without a wedding", async () => {
    const { user } = await signUpUser();
    const dashboard = await getDashboard(authFor(user));
    expect(dashboard.workspace).toBeNull();
    expect(dashboard.viewer).toMatchObject({ name: "Priya Sharma", initials: "PS", role: null });
  });

  it("shows the real wedding, a countdown in the wedding's timezone, and the team with owner first", async () => {
    const { user, cookie } = await signUpUser();
    const result = await call(createWedding, {
      cookie,
      body: {
        title: "Aarav & Diya's Wedding",
        weddingDate: "2099-12-12",
        relationship: "couple",
        location: { address: { city: "Udaipur", state: "Rajasthan" } },
      },
    });
    const weddingId = new Types.ObjectId(result.json.data.wedding.id);

    // A second, earlier-joined member who isn't the owner still lists after the owner.
    const meena = await User.create({ email: "meena@example.com", name: "Meena Kapoor" });
    await WeddingMember.create({
      weddingId,
      userId: meena._id,
      role: "member",
      relationship: "parent",
      joinedAt: new Date("2000-01-01"),
    });

    const { viewer, workspace } = await getDashboard(authFor(user));
    expect(viewer).toMatchObject({ role: "owner", relationship: "couple" });
    expect(workspace).toMatchObject({
      title: "Aarav & Diya's Wedding",
      status: "planning",
      dateLabel: "December 12, 2099",
      locationLabel: "Udaipur, Rajasthan",
      city: "Udaipur",
      counts: { events: 0, guests: 0, pendingTasks: 0, vendors: 0 },
    });
    expect(workspace!.daysUntilWedding).toBeGreaterThan(0);
    expect(workspace!.team.map((member) => [member.name, member.role, member.isYou])).toEqual([
      ["Priya Sharma", "owner", true],
      ["Meena Kapoor", "member", false],
    ]);
  });

  it("never lists another wedding's members", async () => {
    const a = await signUpUser();
    const b = await signUpUser();
    await call(createWedding, { cookie: a.cookie, body: { title: "Wedding A" } });
    await call(createWedding, { cookie: b.cookie, body: { title: "Wedding B" } });

    const { workspace } = await getDashboard(authFor(a.user));
    expect(workspace!.title).toBe("Wedding A");
    expect(workspace!.team).toHaveLength(1);
  });
});

describe("initialsOf()", () => {
  it("takes the first and last name's initials", () => {
    expect(initialsOf("Sunita Sharma")).toBe("SS");
    expect(initialsOf("Aarav Kumar Kapoor")).toBe("AK");
    expect(initialsOf("meena")).toBe("M");
    expect(initialsOf("  ")).toBe("?");
  });
});
