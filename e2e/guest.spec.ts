import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, newVisitor, seedWedding } from "./helpers";

test.describe("guest pages (no account)", () => {
  test("a guest opens their link, answers, and the couple sees the reply", async ({ browser }) => {
    const owner = await newVisitor(browser);
    const seeded = await seedWedding(owner.context);

    const guest = await newVisitor(browser);
    await guest.page.goto(seeded.inviteUrl);
    await expect(guest.page.getByText("Haldi").first()).toBeVisible();
    await expectNoA11yViolations(guest.page, "guest RSVP form");

    await guest.page.getByRole("radio", { name: "Yes" }).first().click();
    await guest.page
      .getByRole("button", { name: /send my response/i })
      .last()
      .click();
    await expect(guest.page.getByText(/thank|received|confirmed|see you/i).first()).toBeVisible();
    await expectNoA11yViolations(guest.page, "guest RSVP confirmation");

    const replies = await owner.context.request.get(
      `/api/v1/weddings/${seeded.weddingId}/rsvps?eventId=${seeded.eventId}`,
    );
    expect((await replies.json()).data.byStatus.attending).toBeGreaterThan(0);

    await guest.context.close();
    await owner.context.close();
  });

  test("a wrong link shows the calm invalid-link page", async ({ browser }) => {
    const { page, context } = await newVisitor(browser);
    await page.goto("/i/this-token-does-not-exist-0000000000000000000");
    await expect(page.getByText(/isn.t working/i).first()).toBeVisible();
    await expectNoA11yViolations(page, "invalid guest link");
    await context.close();
  });
});
