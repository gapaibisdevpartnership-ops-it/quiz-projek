import { test, expect, type Page, type Route } from "@playwright/test";
import { SEED_PASSWORD, SEED_USERS } from "../../helpers/seed";
import { seedChaosQuiz } from "./fixture";

/**
 * Chaos — Layer 2 (client), scenarios #9, #10, #12
 * (docs/CHAOS_TESTING_PLAN.md): the sales user's connection to the app server
 * is slow, drops, or a reload is delayed while they're taking a quiz. Every
 * autosave / submit call from the quiz player is a Next.js Server Action —
 * a POST to the current attempt page URL carrying a `next-action` header —
 * so that's what we intercept with `page.route()`.
 *
 * Each test gets its own freshly seeded quiz: `start_quiz_attempt` resumes an
 * existing in-progress attempt for the same user+quiz, so sharing one quiz
 * across tests would make a later test silently "answer" a question that was
 * already checked by an earlier one.
 */

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function startAttempt(page: Page, quizId: string) {
  await page.goto(`/quizzes/${quizId}/start`);
  await page.waitForURL(/\/attempt\//);
  return page.url();
}

/** Delay every server-action POST on the current page by `ms`. */
async function delayActions(page: Page, ms: number) {
  await page.route("**/quizzes/**/attempt/**", async (route: Route) => {
    if (route.request().method() !== "POST") return route.continue();
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

/** Abort every server-action POST on the current page ("offline"). */
async function dropActions(page: Page) {
  await page.route("**/quizzes/**/attempt/**", async (route: Route) => {
    if (route.request().method() !== "POST") return route.abort("failed");
    await route.abort("failed");
  });
}

test.describe("chaos: quiz player network resilience", () => {
  test("answers keep saving and the timer keeps ticking when every save is slow", async ({
    page,
  }) => {
    const quiz = await seedChaosQuiz({
      title: `CHAOS slow-save ${Date.now()}`,
      questionCount: 2,
      durationMinutes: 20,
    });
    try {
      await login(page, SEED_USERS.sales1.email);
      await startAttempt(page, quiz.quizId);
      await delayActions(page, 1500);

      const countdown = page.locator("span.tabular-nums");
      const first = await countdown.textContent();

      await page.getByLabel("Correct").check();
      // Eventually the save lands — dev-mode React Strict Mode may fire the
      // handler twice (each hitting the delayed route), so give it headroom.
      await expect(page.getByText(/^Saved$/)).toBeVisible({ timeout: 12_000 });

      await page.waitForTimeout(3000);
      const second = await countdown.textContent();
      // The timer is computed from the server-stamped start time and a local
      // interval — it must not freeze just because saves are slow.
      expect(second).not.toBe(first);

      // And the slow save really did land, not just the optimistic UI state.
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(page.getByLabel("Correct")).toBeChecked();
    } finally {
      await quiz.cleanup();
    }
  });

  test("progress is not lost when the connection drops and later recovers", async ({
    page,
  }) => {
    const quiz = await seedChaosQuiz({
      title: `CHAOS drop-recover ${Date.now()}`,
      questionCount: 2,
    });
    try {
      await login(page, SEED_USERS.sales1.email);
      await startAttempt(page, quiz.quizId);

      await dropActions(page);
      await page.getByLabel("Correct").check();
      // The save is doomed to fail while offline — the player must not claim
      // success it didn't earn. Poll rather than a single snapshot: the
      // failure state can take a beat (or a retried request) to settle.
      await expect
        .poll(
          async () =>
            page
              .locator("p.text-muted-foreground.text-xs")
              .last()
              .textContent(),
          { timeout: 8000 },
        )
        .not.toMatch(/^Saved$/);

      // Connection recovers.
      await page.unroute("**/quizzes/**/attempt/**");
      // Retry by re-selecting an answer — the player's documented recovery
      // path (docs/CHAOS_TESTING_PLAN.md notes there is no automatic retry
      // yet). Toggle between the two options until a save actually lands.
      for (let i = 0; i < 5; i++) {
        const target = i % 2 === 0 ? "Wrong" : "Correct";
        await page.getByLabel(target).click({ force: true });
        const saved = await page
          .getByText(/^Saved$/)
          .isVisible()
          .catch(() => false);
        if (saved && target === "Correct") break;
        await page.waitForTimeout(1000);
      }
      if (!(await page.getByLabel("Correct").isChecked())) {
        await page.getByLabel("Correct").click({ force: true });
      }
      await expect(page.getByText(/^Saved$/)).toBeVisible({ timeout: 8000 });

      // Reload from scratch and confirm the answer really persisted
      // server-side — nothing from the offline window silently "stuck".
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(page.getByLabel("Correct")).toBeChecked();
    } finally {
      await quiz.cleanup();
    }
  });

  test("resuming after a slow page reload still shows saved progress", async ({
    page,
  }) => {
    const quiz = await seedChaosQuiz({
      title: `CHAOS slow-resume ${Date.now()}`,
      questionCount: 2,
    });
    try {
      await login(page, SEED_USERS.sales1.email);
      await startAttempt(page, quiz.quizId);

      await page.getByLabel("Correct").check();
      await expect(page.getByText(/^Saved$/)).toBeVisible({ timeout: 8000 });

      // Delay the GET that re-renders the attempt page on reload.
      await page.route("**/quizzes/**/attempt/**", async (route: Route) => {
        if (route.request().method() !== "GET") return route.continue();
        await new Promise((r) => setTimeout(r, 2000));
        await route.continue();
      });
      await page.reload();
      await page.waitForLoadState("networkidle");

      await expect(page.getByLabel("Correct")).toBeChecked();
    } finally {
      await quiz.cleanup();
    }
  });
});
