import { test } from "@playwright/test";
import { expectNoHorizontalScroll, newVisitor, seedWedding } from "./helpers";

// Runs only in the phone project (see playwright.config.ts): nothing may scroll sideways.
test("key screens fit a phone", async ({ browser }) => {
  const owner = await newVisitor(browser);
  const seeded = await seedWedding(owner.context);
  const page = owner.page;
  for (const path of [
    "/dashboard",
    "/dashboard/events",
    "/dashboard/tasks",
    "/dashboard/guests",
    "/dashboard/invitations",
    "/dashboard/expenses",
    "/dashboard/gallery",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page, path);
  }
  const guest = await newVisitor(browser);
  await guest.page.goto(seeded.inviteUrl);
  await expectNoHorizontalScroll(guest.page, "guest RSVP page");
  await guest.context.close();
  await owner.context.close();
});
