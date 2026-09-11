import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, serviceClient, signInAs } from "../helpers/supabase";
import { SEED_USERS } from "../helpers/seed";

/**
 * Chaos — Layer 1 (server), scenario #2 (docs/CHAOS_TESTING_PLAN.md).
 *
 * ⚠️ KNOWN GAP — this test is EXPECTED TO FAIL until
 * docs/IMPROVEMENT_BACKLOG.md P2 #11 is fixed. `save_objective_answer` reads
 * the attempt's status without locking the row, while `submit_quiz_attempt`
 * takes `FOR UPDATE` and scores the attempt inside that same transaction. If a
 * save's read-then-write straddles a concurrent submit's lock, the save can
 * write a fresh answer to the database *after* the attempt has already been
 * scored and finalised — violating "Submitted Attempt Immutability"
 * (docs/SECURITY_RLS.md) without the caller ever seeing an error.
 *
 * Not part of the default gate — a red result here is expected and tracked.
 * Flip the TODO'd assertion once P2 #11 lands.
 */

const d = hasSupabaseEnv ? describe : describe.skip;
const ROUNDS = 8;

d("chaos: save_objective_answer racing submit_quiz_attempt", () => {
  const svc = hasSupabaseEnv ? serviceClient() : (null as never);
  let sales: SupabaseClient;

  const ids = { category: "", question: "", correctOption: "", quiz: "" };

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
      .insert({ name: `CHAOS save-submit-race ${Date.now()}` })
      .select("id")
      .single();
    ids.category = cat.data!.id;

    const q = await svc
      .from("questions")
      .insert({
        category_id: ids.category,
        question_type: "single_choice",
        question_text: "Chaos save-vs-submit question",
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
        title: `CHAOS save-vs-submit ${Date.now()}`,
        status: "published",
        passing_score: 50,
        max_attempts: ROUNDS,
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
  });

  afterAll(async () => {
    if (!ids.quiz) return;
    await svc.from("quiz_attempts").delete().eq("quiz_id", ids.quiz);
    await svc.from("quizzes").delete().eq("id", ids.quiz);
    await svc.from("questions").delete().eq("id", ids.question);
    await svc.from("quiz_categories").delete().eq("id", ids.category);
    await sales?.auth.signOut();
  });

  it(`never scores an attempt inconsistently with its saved answers, across ${ROUNDS} rounds`, async () => {
    const violations: { round: number; storedScore: number; actuallyAnswered: boolean }[] =
      [];

    for (let round = 0; round < ROUNDS; round++) {
      const start = await sales.rpc("start_quiz_attempt", { target_quiz_id: ids.quiz });
      const attemptId = start.data as string;
      const payload = await sales.rpc("get_attempt_for_player", {
        target_attempt_id: attemptId,
      });
      const attemptQuestionId = (
        payload.data as { questions: { id: string }[] }
      ).questions[0].id;

      // Fire the save and the submit at (as close to) the same instant.
      await Promise.allSettled([
        sales.rpc("save_objective_answer", {
          target_attempt_question_id: attemptQuestionId,
          selected_option_ids: [ids.correctOption],
        }),
        sales.rpc("submit_quiz_attempt", { target_attempt_id: attemptId }),
      ]);

      const { data: attempt } = await svc
        .from("quiz_attempts")
        .select("final_score")
        .eq("id", attemptId)
        .single();
      const { data: selected } = await svc
        .from("attempt_answer_options")
        .select("attempt_question_option_id, attempt_answers!inner(attempt_question_id)")
        .eq("attempt_answers.attempt_question_id", attemptQuestionId);

      const actuallyAnswered =
        (selected ?? []).some(
          (r) => r.attempt_question_option_id === ids.correctOption,
        ) ?? false;
      const storedScore = Number(attempt!.final_score ?? 0);
      const expectedScore = actuallyAnswered ? 1 : 0;

      if (storedScore !== expectedScore) {
        violations.push({ round, storedScore, actuallyAnswered });
      }
    }

    // TODO(P2 #11): once save_objective_answer / save_essay_answer take
    // FOR UPDATE on the attempt before checking status = 'in_progress', this
    // must be: expect(violations).toEqual([]).
    if (violations.length > 0) {
      console.warn(
        `[chaos] save-vs-submit race reproduced (P2 #11 open): ${JSON.stringify(violations)}`,
      );
    }
    expect(violations, "final_score must always match the saved answers").toEqual(
      [],
    );
  });
});
