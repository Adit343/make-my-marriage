import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, newVisitor } from "./helpers";

const PAGES = ["/", "/login", "/signup", "/forgot-password"];

test.describe("signed-out pages", () => {
  for (const path of PAGES) {
    test(`${path} loads and passes the accessibility scan`, async ({ browser }) => {
      const { page, context } = await newVisitor(browser);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
      await expectNoA11yViolations(page, path);
      expect(errors).toEqual([]);
      await context.close();
    });
  }

  test("an unknown address shows the friendly not-found page", async ({ browser }) => {
    const { page, context } = await newVisitor(browser);
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expectNoA11yViolations(page, "not found");
    await context.close();
  });

  test("the dashboard sends a signed-out visitor to log in", async ({ browser }) => {
    const { page, context } = await newVisitor(browser);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });
});
