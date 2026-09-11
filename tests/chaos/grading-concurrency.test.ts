import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, serviceClient, signInAs } from "../helpers/supabase";
import { SEED_USERS } from "../helpers/seed";

/**
 * Chaos — Layer 1 (server), scenario #4 (docs/CHAOS_TESTING_PLAN.md): two
 * trainers grade the same essay answer at the same moment (e.g. two browser
 * tabs, or two reviewers who didn't coordinate). `grade_essay_answer` writes a
 * single row with a plain UPDATE and calls `finalize_attempt` (idempotent) —
 * expected to stay consistent even without an explicit row lock.
 */

const d = hasSupabaseEnv ? describe : describe.skip;

d("chaos: concurrent essay grading", () => {
  const svc = hasSupabaseEnv ? serviceClient() : (null as never);
  let sales: SupabaseClient;
  let trainer: SupabaseClient;
  let superAdmin: SupabaseClient;

  const ids = {
    category: "",
    question: "",
    quiz: "",
    attempt: "",
    attemptQuestion: "",
    answerId: "",
  };

  beforeAll(async () => {
    sales = await signInAs(SEED_USERS.sales1.email);
    trainer = await signInAs(SEED_USERS.trainer.email);
    superAdmin = await signInAs(SEED_USERS.superAdmin.email);
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
      .insert({ name: `CHAOS grading ${Date.now()}` })
      .select("id")
      .single();
    ids.category = cat.data!.id;

    const q = await svc
      .from("questions")
      .insert({
        category_id: ids.category,
        question_type: "essay",
        question_text: "Chaos grading-concurrency essay",
        created_by: trainerProfile!.user_id,
      })
      .select("id")
      .single();
    ids.question = q.data!.id;

    const quiz = await svc
      .from("quizzes")
      .insert({
        title: `CHAOS grading-concurrency ${Date.now()}`,
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
      .insert({ quiz_id: ids.quiz, question_id: ids.question, points: 10, sort_order: 0 });
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
    ids.attemptQuestion = (
      payload.data as { questions: { id: string }[] }
    ).questions[0].id;
    await sales.rpc("save_essay_answer", {
      target_attempt_question_id: ids.attemptQuestion,
      essay: "grade me",
    });
    await sales.rpc("submit_quiz_attempt", { target_attempt_id: ids.attempt });

    const { data: answerRow } = await svc
      .from("attempt_answers")
      .select("id")
      .eq("attempt_id", ids.attempt)
      .eq("attempt_question_id", ids.attemptQuestion)
      .single();
    ids.answerId = answerRow!.id;
  });

  afterAll(async () => {
    if (!ids.quiz) return;
    await svc.from("quiz_attempts").delete().eq("quiz_id", ids.quiz);
    await svc.from("quizzes").delete().eq("id", ids.quiz);
    await svc.from("questions").delete().eq("id", ids.question);
    await svc.from("quiz_categories").delete().eq("id", ids.category);
    await sales?.auth.signOut();
    await trainer?.auth.signOut();
    await superAdmin?.auth.signOut();
  });

  it("two trainers grading the same answer at once leaves one consistent, valid score", async () => {
    const [r1, r2] = await Promise.all([
      trainer.rpc("grade_essay_answer", {
        target_answer_id: ids.answerId,
        score: 7,
        feedback: "from trainer",
      }),
      superAdmin.rpc("grade_essay_answer", {
        target_answer_id: ids.answerId,
        score: 9,
        feedback: "from super admin",
      }),
    ]);

    expect(r1.error, r1.error?.message).toBeNull();
    expect(r2.error, r2.error?.message).toBeNull();

    const { data: answer } = await svc
      .from("attempt_answers")
      .select("manual_score, grader_feedback")
      .eq("id", ids.answerId)
      .single();
    // Last write wins — but it must be one of the two, not a corrupted blend.
    expect([7, 9]).toContain(Number(answer!.manual_score));
    expect(["from trainer", "from super admin"]).toContain(
      answer!.grader_feedback,
    );

    const { data: attempt } = await svc
      .from("quiz_attempts")
      .select("status, manual_score, final_score, percentage, passed")
      .eq("id", ids.attempt)
      .single();
    expect(attempt!.status).toBe("submitted");
    // finalize_attempt is idempotent — the final score must match whichever
    // grade actually persisted, not double-count both attempts.
    expect(Number(attempt!.manual_score)).toBe(Number(answer!.manual_score));
    expect(Number(attempt!.final_score)).toBe(Number(answer!.manual_score));
  });
});
