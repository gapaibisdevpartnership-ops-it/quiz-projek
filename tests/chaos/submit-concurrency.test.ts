import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, serviceClient, signInAs } from "../helpers/supabase";
import { SEED_USERS } from "../helpers/seed";

/**
 * Chaos — Layer 1 (server), scenario #3 (docs/CHAOS_TESTING_PLAN.md):
 * `submit_quiz_attempt` hammered with many concurrent calls on the same
 * attempt. `submit_quiz_attempt` takes `FOR UPDATE` on the attempt row, so
 * this is expected to stay green — it's the baseline that proves the lock
 * actually serialises concurrent submits, not just sequential idempotency
 * (already covered in tests/integration/attempt-security.test.ts).
 */

const d = hasSupabaseEnv ? describe : describe.skip;
const CONCURRENCY = 20;

d("chaos: submit_quiz_attempt under heavy concurrency", () => {
  const svc = hasSupabaseEnv ? serviceClient() : (null as never);
  let sales: SupabaseClient;

  const ids = {
    category: "",
    question: "",
    correctOption: "",
    quiz: "",
    attempt: "",
  };

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
      .insert({ name: `CHAOS submit ${Date.now()}` })
      .select("id")
      .single();
    ids.category = cat.data!.id;

    const q = await svc
      .from("questions")
      .insert({
        category_id: ids.category,
        question_type: "single_choice",
        question_text: "Chaos submit-concurrency question",
        created_by: trainerProfile!.user_id,
      })
      .select("id")
      .single();
    ids.question = q.data!.id;

    const opts = await svc
      .from("question_options")
      .insert([
        { question_id: ids.question, answer_text: "right", is_correct: true, sort_order: 0 },
        { question_id: ids.question, answer_text: "wrong", is_correct: false, sort_order: 1 },
      ])
      .select("id, is_correct");
    ids.correctOption = opts.data!.find((o) => o.is_correct)!.id;

    const quiz = await svc
      .from("quizzes")
      .insert({
        title: `CHAOS submit-concurrency ${Date.now()}`,
        status: "published",
        passing_score: 50,
        max_attempts: 1,
        created_by: trainerProfile!.user_id,
      })
      .select("id")
      .single();
    ids.quiz = quiz.data!.id;

    await svc
      .from("quiz_questions")
      .insert({ quiz_id: ids.quiz, question_id: ids.question, points: 1, sort_order: 0 });
    await svc.from("quiz_assignments").insert({
      quiz_id: ids.quiz,
      user_id: salesProfile!.user_id,
      assigned_by: trainerProfile!.user_id,
    });

    const start = await sales.rpc("start_quiz_attempt", { target_quiz_id: ids.quiz });
    ids.attempt = start.data as string;

    const payload = await sales.rpc("get_attempt_for_player", {
      target_attempt_id: ids.attempt,
    });
    const question = (
      payload.data as { questions: { id: string; options: { id: string }[] }[] }
    ).questions[0];
    await sales.rpc("save_objective_answer", {
      target_attempt_question_id: question.id,
      selected_option_ids: [question.options[0].id],
    });
  });

  afterAll(async () => {
    if (!ids.quiz) return;
    await svc.from("quiz_attempts").delete().eq("quiz_id", ids.quiz);
    await svc.from("quizzes").delete().eq("id", ids.quiz);
    await svc.from("questions").delete().eq("id", ids.question);
    await svc.from("quiz_categories").delete().eq("id", ids.category);
    await sales?.auth.signOut();
  });

  it(`stays consistent under ${CONCURRENCY} concurrent submits of the same attempt`, async () => {
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        sales.rpc("submit_quiz_attempt", { target_attempt_id: ids.attempt }),
      ),
    );

    // Invariant 1: no raw/unexpected errors — every call either succeeds or
    // reports a clean domain result, never throws or surfaces a bare
    // Postgres protocol error.
    for (const r of results) {
      expect(r.error, r.error?.message).toBeNull();
    }

    // Invariant 2: exactly one call did the finalising; the rest observed it
    // already finalised.
    const statuses = results.map(
      (r) => (r.data as { status: string; alreadyFinalized: boolean }).status,
    );
    const alreadyFinalizedCount = results.filter(
      (r) => (r.data as { alreadyFinalized: boolean }).alreadyFinalized,
    ).length;
    expect(new Set(statuses).size).toBe(1);
    expect(alreadyFinalizedCount).toBe(CONCURRENCY - 1);

    // Invariant 3: the row in the database reflects a single, stable result.
    const { data: attempt } = await svc
      .from("quiz_attempts")
      .select("status, final_score, percentage, submitted_at")
      .eq("id", ids.attempt)
      .single();
    expect(attempt!.status).toBe("submitted");
    expect(Number(attempt!.final_score)).toBe(1);
    expect(Number(attempt!.percentage)).toBe(100);
  });
});
