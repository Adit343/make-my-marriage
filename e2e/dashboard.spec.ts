import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, newVisitor, PASSWORD, seedWedding } from "./helpers";

const SCREENS = [
  ["Overview", "/dashboard"],
  ["Members", "/dashboard/team"],
  ["Settings", "/dashboard/settings"],
  ["Events", "/dashboard/events"],
  ["Tasks", "/dashboard/tasks"],
  ["Guests", "/dashboard/guests"],
  ["Invitations", "/dashboard/invitations"],
  ["Expenses", "/dashboard/expenses"],
  ["Vendors", "/dashboard/vendors"],
  ["Website", "/dashboard/website"],
  ["Live streams", "/dashboard/live"],
  ["Gallery", "/dashboard/gallery"],
] as const;

test.describe("a wedding owner's screens", () => {
  test("every screen loads with real data and passes the accessibility scan", async ({
    browser,
  }) => {
    const { page, context } = await newVisitor(browser);
    const seeded = await seedWedding(context);
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));

    for (const [name, path] of SCREENS) {
      const response = await page.goto(path);
      expect(response?.status(), name).toBe(200);
      await expect(page.locator("h1").first(), name).toBeAttached();
      await page.waitForLoadState("networkidle");
      await expectNoA11yViolations(page, name);
    }

    await page.goto("/dashboard/events");
    await expect(page.getByText("Haldi").first()).toBeVisible();
    await page.goto("/dashboard/guests");
    await expect(page.getByText("Rahul Sharma").first()).toBeVisible();
    await page.goto("/dashboard/tasks");
    await expect(page.getByText("Book the decorator").first()).toBeVisible();
    await page.goto(`/dashboard/events/${seeded.eventId}`);
    await expectNoA11yViolations(page, "Event page");
    expect(problems).toEqual([]);
    await context.close();
  });

  test("logging out and back in works", async ({ browser }) => {
    const { page, context } = await newVisitor(browser);
    const { email } = await seedWedding(context);
    await context.request.post("/api/v1/auth/logout");
    await page.goto("/login");
    await page.getByLabel(/email/i).first().fill(email);
    await page
      .getByLabel(/password/i)
      .first()
      .fill(PASSWORD);
    await page
      .getByRole("button", { name: /log in|sign in/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/dashboard/);
    await context.close();
  });
});
