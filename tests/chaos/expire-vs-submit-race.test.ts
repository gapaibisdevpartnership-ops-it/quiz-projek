import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, serviceClient, signInAs } from "../helpers/supabase";
import { SEED_USERS } from "../helpers/seed";

/**
 * Chaos — Layer 1 (server), scenario #5 (docs/CHAOS_TESTING_PLAN.md): the
 * `expire_stale_attempts()` sweep runs at the exact moment the user submits
 * the same attempt themselves. `submit_quiz_attempt` takes `FOR UPDATE`;
 * `expire_stale_attempts` takes `FOR UPDATE ... SKIP LOCKED` specifically so
 * the two never deadlock — this is the test that proves it.
 */

const d = hasSupabaseEnv ? describe : describe.skip;
const MIN = 60 * 1000;

d("chaos: expire_stale_attempts racing a live submit", () => {
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
      .insert({ name: `CHAOS expire-race ${Date.now()}` })
      .select("id")
      .single();
    ids.category = cat.data!.id;

    const q = await svc
      .from("questions")
      .insert({
        category_id: ids.category,
        question_type: "single_choice",
        question_text: "Chaos expire-vs-submit question",
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
        title: `CHAOS expire-vs-submit ${Date.now()}`,
        status: "published",
        passing_score: 50,
        max_attempts: 1,
        duration_minutes: 30,
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

    // Push the attempt past its own deadline so the sweep considers it stale
    // — right as the user is (in this test) about to submit it themselves.
    await svc
      .from("quiz_attempts")
      .update({ started_at: new Date(Date.now() - 45 * MIN).toISOString() })
      .eq("id", ids.attempt);
  });

  afterAll(async () => {
    if (!ids.quiz) return;
    await svc.from("quiz_attempts").delete().eq("quiz_id", ids.quiz);
    await svc.from("quizzes").delete().eq("id", ids.quiz);
    await svc.from("questions").delete().eq("id", ids.question);
    await svc.from("quiz_categories").delete().eq("id", ids.category);
    await sales?.auth.signOut();
  });

  it("racing the sweep against a live submit never deadlocks and never double-scores", async () => {
    const [submitResult, sweepResult] = await Promise.all([
      sales.rpc("submit_quiz_attempt", { target_attempt_id: ids.attempt }),
      svc.rpc("expire_stale_attempts"),
    ]);

    expect(submitResult.error, submitResult.error?.message).toBeNull();
    expect(sweepResult.error, sweepResult.error?.message).toBeNull();

    const { data: attempt } = await svc
      .from("quiz_attempts")
      .select("status, final_score, percentage, passed")
      .eq("id", ids.attempt)
      .single();
    expect(attempt!.status).toBe("submitted");
    expect(Number(attempt!.final_score)).toBe(1);
    expect(Number(attempt!.percentage)).toBe(100);
    expect(attempt!.passed).toBe(true);
  });
});
