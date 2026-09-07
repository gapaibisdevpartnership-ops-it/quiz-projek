import { test, expect, devices } from "@playwright/test";
import { SEED_PASSWORD, SEED_USERS } from "../helpers/seed";

/**
 * Phase 8 follow-up — responsive QA. Loads the core screens at a phone width
 * and a small-laptop width and asserts the page never scrolls horizontally
 * (a reliable proxy for broken/overflowing layout). See docs/RELEASE_CHECKLIST.md.
 */

const VIEWPORTS = [
  { name: "iphone-se", ...devices["iPhone SE"].viewport },
  { name: "laptop-1280", width: 1280, height: 800 },
];

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function expectNoHorizontalScroll(page: import("@playwright/test").Page, where: string) {
  const overflowBy = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflowBy, `${where} overflows horizontally by ${overflowBy}px`).toBeLessThanOrEqual(1);
}

for (const vp of VIEWPORTS) {
  test.describe(`responsive @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("sales core screens do not overflow horizontally", async ({ page }) => {
      await page.goto("/login");
      await expectNoHorizontalScroll(page, "/login");

      await login(page, SEED_USERS.sales1.email);
      for (const route of ["/dashboard", "/quizzes", "/history", "/leaderboard", "/profile"]) {
        await page.goto(route);
        await expectNoHorizontalScroll(page, route);
      }
    });

    test("admin builder screens do not overflow horizontally", async ({ page }) => {
      await login(page, SEED_USERS.trainer.email);
      for (const route of [
        "/admin/quizzes",
        "/admin/questions",
        "/admin/users",
        "/admin/teams",
        "/admin/results",
        "/admin/grading",
        "/admin/analytics",
      ]) {
        await page.goto(route);
        await expectNoHorizontalScroll(page, route);
      }
    });
  });
}
