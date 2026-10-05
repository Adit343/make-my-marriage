import { describe, expect, it } from "vitest";
import { MEMBER_ROLES } from "@/lib/constants/enums";
import { can, PERMISSIONS, type Permission } from "@/modules/members/permissions";

// Decision D3: owner everything; admin everything except transfer/delete; member views all.
describe("role matrix", () => {
  const expected: Record<Permission, [owner: boolean, admin: boolean, member: boolean]> = {
    "wedding:view": [true, true, true],
    "wedding:update": [true, true, false],
    "wedding:delete": [true, false, false],
    "ownership:transfer": [true, false, false],
    "members:manage": [true, true, false],
  };

  it.each(Object.entries(expected) as [Permission, boolean[]][])("%s", (permission, allowed) => {
    expect(MEMBER_ROLES.map((role) => can(role, permission))).toEqual(allowed);
  });

  it("is covered by this test (add a row above when a permission is added)", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(expected).sort());
  });
});
