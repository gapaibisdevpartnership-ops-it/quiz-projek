import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, serviceClient, signInAs } from "../helpers/supabase";
import { SEED_USERS } from "../helpers/seed";

/**
 * Chaos — Layer 1 (server), scenario #1 (docs/CHAOS_TESTING_PLAN.md).
 *
 * ⚠️ KNOWN GAP — this test is EXPECTED TO FAIL until
 * docs/IMPROVEMENT_BACKLOG.md P1 #6 is fixed. `start_quiz_attempt` has no
 * advisory lock and no partial unique index on (quiz_id, user_id) where
 * status = 'in_progress'. Its "resume?" check, its `count(*) >= max_attempts`
 * check, and its `next attempt_number` computation are three separate
 * unlocked reads — a burst of concurrent calls can interleave so that two of
 * them each compute the SAME "count so far" (before either commits) and then,
 * after the first one commits, the second re-reads a fresh `max(attempt_number)`
 * and inserts a second, distinct attempt — exceeding `max_attempts`.
 *
 * This suite is not part of the default gate (docs/CHAOS_TESTING_PLAN.md) —
 * a red result here is expected and tracked, not a regression to chase down
 * in this PR. Flip the two `expect(...)` calls' inverse once P1 #6 lands (see
 * the TODO below) and this becomes a real regression guard.
 */

const d = hasSupabaseEnv ? describe : describe.skip;
const CONCURRENCY = 10;
const ROUNDS = 4;

d("chaos: start_quiz_attempt race under max_attempts = 1", () => {
  const svc = hasSupabaseEnv ? serviceClient() : (null as never);
  let sales: SupabaseClient;
  let categoryId = "";
  let questionId = "";
  const quizIds: string[] = [];

  beforeAll(async () => {
    sales = await signInAs(SEED_USERS.sales1.email);
    const { data: trainerProfile } = await svc
      .from("profiles")
      .select("user_id")
      .eq("email", SEED_USERS.trainer.email)
      .single();
    const { data: salesProfile } = await svc
      .from("profiles")
      .select("user_id")
      .eq("email", SEED_USERS.sales1.email)
      .single();

    const cat = await svc
      .from("quiz_categories")
      .insert({ name: `CHAOS start-race ${Date.now()}` })
      .select("id")
      .single();
    categoryId = cat.data!.id;

    const q = await svc
      .from("questions")
      .insert({
        category_id: categoryId,
        question_type: "single_choice",
        question_text: "Chaos start-race question",
        created_by: trainerProfile!.user_id,
      })
      .select("id")
      .single();
    questionId = q.data!.id;
    await svc
      .from("question_options")
      .insert({ question_id: questionId, answer_text: "x", is_correct: true, sort_order: 0 });

    for (let i = 0; i < ROUNDS; i++) {
      const quiz = await svc
        .from("quizzes")
        .insert({
          title: `CHAOS start-race round ${i} ${Date.now()}`,
          status: "published",
          passing_score: 50,
          max_attempts: 1,
          created_by: trainerProfile!.user_id,
        })
        .select("id")
        .single();
      const quizId = quiz.data!.id;
      quizIds.push(quizId);
      await svc
        .from("quiz_questions")
        .insert({ quiz_id: quizId, question_id: questionId, points: 1, sort_order: 0 });
      await svc.from("quiz_assignments").insert({
        quiz_id: quizId,
        user_id: salesProfile!.user_id,
        assigned_by: trainerProfile!.user_id,
      });
    }
  });

  afterAll(async () => {
    for (const quizId of quizIds) {
      await svc.from("quiz_attempts").delete().eq("quiz_id", quizId);
      await svc.from("quizzes").delete().eq("id", quizId);
    }
    if (questionId) await svc.from("questions").delete().eq("id", questionId);
    if (categoryId) await svc.from("quiz_categories").delete().eq("id", categoryId);
    await sales?.auth.signOut();
  });

  it(`never creates more than max_attempts (1) attempts across ${ROUNDS} rounds of ${CONCURRENCY} concurrent starts`, async () => {
    const violations: { round: number; count: number }[] = [];

    for (let round = 0; round < ROUNDS; round++) {
      const quizId = quizIds[round];
      await Promise.allSettled(
        Array.from({ length: CONCURRENCY }, () =>
          sales.rpc("start_quiz_attempt", { target_quiz_id: quizId }),
        ),
      );

      const { count } = await svc
        .from("quiz_attempts")
        .select("id", { count: "exact", head: true })
        .eq("quiz_id", quizId);

      if ((count ?? 0) > 1) violations.push({ round, count: count ?? 0 });
    }

    // TODO(P1 #6): once start_quiz_attempt is fixed to serialise concurrent
    // starts (advisory lock or a partial unique index on
    // (quiz_id, user_id) where status = 'in_progress'), this must be:
    //   expect(violations).toEqual([]);
    // Today it documents the gap instead of silently skipping it.
    if (violations.length > 0) {
      console.warn(
        `[chaos] start_quiz_attempt race reproduced (P1 #6 open): ${JSON.stringify(violations)}`,
      );
    }
    expect(violations, "no round exceeded max_attempts").toEqual([]);
  });
});
