import { test, expect } from "@playwright/test";
import { SEED_PASSWORD, SEED_USERS } from "../helpers/seed";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

const ADMIN_ROUTES = [
  "/admin/quizzes",
  "/admin/questions",
  "/admin/users",
  "/admin/teams",
  "/admin/results",
  "/admin/grading",
  "/admin/analytics",
];

test("a sales user is redirected away from every admin route", async ({
  page,
}) => {
  await login(page, SEED_USERS.sales1.email);
  for (const route of ADMIN_ROUTES) {
    await page.goto(route);
    await expect(page, `sales blocked from ${route}`).toHaveURL(/\/dashboard/);
  }
});

test("a trainer can open the admin sections", async ({ page }) => {
  await login(page, SEED_USERS.trainer.email);
  for (const route of ADMIN_ROUTES) {
    await page.goto(route);
    await expect(page, `trainer allowed on ${route}`).toHaveURL(
      new RegExp(route.replace("/", "\\/")),
    );
  }
});

test("the leaderboard is reachable by a sales user", async ({ page }) => {
  await login(page, SEED_USERS.sales1.email);
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
});
