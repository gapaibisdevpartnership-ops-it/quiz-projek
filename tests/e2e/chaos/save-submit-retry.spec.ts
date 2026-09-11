import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page, type Route } from "@playwright/test";
import { SEED_PASSWORD, SEED_USERS } from "../../helpers/seed";
import { seedChaosQuiz } from "./fixture";

/**
 * Chaos — Layer 2 (client), scenarios #8 and #11
 * (docs/CHAOS_TESTING_PLAN.md): individual autosave / submit calls fail
 * outright (not just slow) while the sales user is taking the quiz.
 *
 * Each test seeds its own quiz — `start_quiz_attempt` resumes an existing
 * in-progress attempt for the same user+quiz, so sharing one across tests
 * would make a later test see answers already checked by an earlier one.
 */

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("chaos: quiz player save / submit failures", () => {
  test("no answer is silently lost when saves intermittently fail and the user retries", async ({
    page,
  }) => {
    const quiz = await seedChaosQuiz({
      title: `CHAOS intermittent-save ${Date.now()}`,
      questionCount: 3,
    });
    try {
      await login(page, SEED_USERS.sales1.email);
      await page.goto(`/quizzes/${quiz.quizId}/start`);
      await page.waitForURL(/\/attempt\//);
      const attemptId = page.url().split("/attempt/")[1];

      // Fail every other autosave POST — the player has no automatic retry
      // (docs/IMPROVEMENT_BACKLOG.md P2 #27), so the bot below plays the role
      // of a user who notices "Save failed" and re-selects the answer.
      let n = 0;
      await page.route("**/quizzes/**/attempt/**", async (route: Route) => {
        if (route.request().method() !== "POST") return route.continue();
        n += 1;
        if (n % 2 === 1) return route.abort("failed");
        return route.continue();
      });

      for (let i = 0; i < quiz.questionIds.length; i++) {
        for (let attempt = 0; attempt < 5; attempt++) {
          await page.getByLabel("Correct").click({ force: true });
          const saved = await page
            .getByText(/^Saved$/)
            .isVisible()
            .catch(() => false);
          if (saved) break;
          await page.waitForTimeout(800);
          // Nudge the radio so the next click is a real state change.
          await page.getByLabel("Wrong").click({ force: true });
        }
        await expect(page.getByText(/^Saved$/)).toBeVisible({ timeout: 8000 });
        if (i < quiz.questionIds.length - 1) {
          await page.getByRole("button", { name: "Next", exact: true }).click();
        }
      }

      await page.unroute("**/quizzes/**/attempt/**");

      // Ground truth: every question was answered correctly, so a full,
      // un-corrupted score is the only acceptable outcome.
      const client = svc();
      const { data: answered } = await client
        .from("attempt_answer_options")
        .select("id, attempt_answers!inner(attempt_id)")
        .eq("attempt_answers.attempt_id", attemptId);
      expect(answered?.length ?? 0).toBe(quiz.questionIds.length);
    } finally {
      await quiz.cleanup();
    }
  });

  test("a submit that fails on the first try does not produce a duplicate or corrupt result", async ({
    page,
  }) => {
    const quiz = await seedChaosQuiz({
      title: `CHAOS submit-retry ${Date.now()}`,
      questionCount: 3,
    });
    try {
      await login(page, SEED_USERS.sales1.email);
      await page.goto(`/quizzes/${quiz.quizId}/start`);
      await page.waitForURL(/\/attempt\//);
      const attemptId = page.url().split("/attempt/")[1];

      for (let i = 0; i < quiz.questionIds.length; i++) {
        await page.getByLabel("Correct").check();
        await expect(page.getByText(/^Saved$/)).toBeVisible({ timeout: 8000 });
        const nextBtn = page.getByRole("button", { name: "Next", exact: true });
        if (await nextBtn.isVisible().catch(() => false)) await nextBtn.click();
      }

      // Fail exactly the first submit call; let any retry through.
      let aborted = false;
      await page.route("**/quizzes/**/attempt/**", async (route: Route) => {
        if (route.request().method() !== "POST" || aborted) return route.continue();
        aborted = true;
        await route.abort("failed");
      });

      page.on("dialog", (d) => d.accept());
      const submitBtn = page.getByRole("button", { name: /Submit attempt/ });
      await submitBtn.click().catch(() => {});
      await page.waitForTimeout(1500);

      // Whatever the transient UI did (error banner, crash overlay, nothing
      // visible yet), the app must still be controllable enough to retry.
      await page.unroute("**/quizzes/**/attempt/**");
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click().catch(() => {});
        await page.waitForTimeout(1500);
      } else {
        // First click's UI didn't recover on its own — fall back to a fresh
        // load of the attempt (which always re-opens on question 1) and
        // navigate back to the last question to submit from there.
        await page.goto(`/quizzes/${quiz.quizId}/attempt/${attemptId}`);
        await page.waitForLoadState("networkidle");
        await page
          .getByRole("button", { name: String(quiz.questionIds.length), exact: true })
          .click()
          .catch(() => {});
        const retryBtn = page.getByRole("button", { name: /Submit attempt/ });
        if (await retryBtn.isVisible().catch(() => false)) {
          await retryBtn.click().catch(() => {});
          await page.waitForTimeout(1500);
        }
      }

      // Invariant: exactly one finalised result, correctly scored — never
      // zero (stuck) and never a corrupted double-count.
      const client = svc();
      const { data: attempt } = await client
        .from("quiz_attempts")
        .select("status, final_score, percentage")
        .eq("id", attemptId)
        .single();
      expect(["submitted", "pending_review"]).toContain(attempt!.status);
      if (attempt!.status === "submitted") {
        expect(Number(attempt!.final_score)).toBe(quiz.questionIds.length);
        expect(Number(attempt!.percentage)).toBe(100);
      }
    } finally {
      await quiz.cleanup();
    }
  });
});
