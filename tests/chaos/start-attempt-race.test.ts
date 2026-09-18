import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, serviceClient, signInAs } from "../helpers/supabase";
import { SEED_USERS } from "../helpers/seed";

/**
 * Chaos — Layer 1 (server), scenario #1 (docs/CHAOS_TESTING_PLAN.md).
 *
 * ✅ FIXED — docs/IMPROVEMENT_BACKLOG.md P1 #6 / docs/START_ATTEMPT_RACE_FIX_PLAN.md.
 * `start_quiz_attempt` now takes a transaction-scoped `pg_advisory_xact_lock`
 * keyed on `(quiz_id, user_id)` before its resume-check / count-check /
 * attempt_number computation, serializing concurrent calls for the same
 * pair. Applied to production 2026-09-18
 * (`supabase/migrations/20260914090000_start_attempt_lock.sql`); this test
 * is a real regression guard now, not a documented known-gap.
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

    expect(violations, "no round exceeded max_attempts").toEqual([]);
  });
});
