import { test, expect } from "@playwright/test";
import { SEED_PASSWORD, SEED_USERS } from "../helpers/seed";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("unauthenticated user is redirected from a protected route", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("invalid credentials show an error and stay on /login", async ({
  page,
}) => {
  await login(page, "nobody@example.com");
  await expect(
    page.getByRole("alert").filter({ hasText: /incorrect/i }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("a trainer signs in and sees admin navigation", async ({ page }) => {
  await login(page, SEED_USERS.trainer.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Question Bank" }),
  ).toBeVisible();
});

test("a sales user is bounced from an admin route", async ({ page }) => {
  await login(page, SEED_USERS.sales1.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole("link", { name: "Question Bank" }),
  ).toHaveCount(0);

  await page.goto("/admin/quizzes");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("sign out returns to /login", async ({ page }) => {
  await login(page, SEED_USERS.sales1.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
});
