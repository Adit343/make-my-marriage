import { describe, expect, it } from "vitest";
import { PATCH as patchMe } from "@/app/api/v1/users/me/route";
import { setupTestDatabase } from "../../setup/database";
import { signUpUser } from "../../setup/auth";
import { call } from "../../setup/http";

setupTestDatabase();

describe("cross-site writes (Origin check)", () => {
  it("refuses a write that a browser says came from another site, even with a valid cookie", async () => {
    const { cookie } = await signUpUser();
    const result = await call(patchMe, {
      method: "PATCH",
      cookie,
      body: { name: "Hijacked" },
      headers: { origin: "https://evil.example" },
    });
    expect(result.status).toBe(403);
    expect(result.json.error.message).toBe("Cross-site request refused");
  });

  it("allows the same write from this site", async () => {
    const { cookie } = await signUpUser();
    const result = await call(patchMe, {
      method: "PATCH",
      cookie,
      body: { name: "Priya" },
      headers: { origin: "http://localhost:3000" },
    });
    expect(result.status).toBe(200);
  });
});
