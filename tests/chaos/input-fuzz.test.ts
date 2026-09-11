import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, serviceClient, signInAs } from "../helpers/supabase";
import { SEED_USERS } from "../helpers/seed";

/**
 * Chaos — Layer 1 (server), scenario #6 (docs/CHAOS_TESTING_PLAN.md):
 * garbage / adversarial input against every attempt & grading RPC. The
 * invariant isn't "it succeeds" — it's "it never crashes and never silently
 * accepts nonsense": every call must return a clean domain error (or a
 * bounded success), never a raw/opaque failure.
 */

const d = hasSupabaseEnv ? describe : describe.skip;
const RANDOM_UUID = "00000000-0000-0000-0000-000000000000";

d("chaos: adversarial input on attempt & grading RPCs", () => {
  const svc = hasSupabaseEnv ? serviceClient() : (null as never);
  let sales: SupabaseClient;
  let trainer: SupabaseClient;

  const ids = {
    category: "",
    questionA: "",
    questionB: "",
    optionOnA: "",
    optionOnB: "",
    essayQuestion: "",
    quiz: "",
    attempt: "",
    attemptQuestionA: "",
    essayAttemptQuestion: "",
    essayAnswerId: "",
  };

  beforeAll(async () => {
    sales = await signInAs(SEED_USERS.sales1.email);
    trainer = await signInAs(SEED_USERS.trainer.email);
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
      .insert({ name: `CHAOS fuzz ${Date.now()}` })
      .select("id")
      .single();
    ids.category = cat.data!.id;

    const [qa, qb, essay] = await Promise.all([
      svc
        .from("questions")
        .insert({
          category_id: ids.category,
          question_type: "single_choice",
          question_text: "Fuzz question A",
          created_by: trainerProfile!.user_id,
        })
        .select("id")
        .single(),
      svc
        .from("questions")
        .insert({
          category_id: ids.category,
          question_type: "single_choice",
          question_text: "Fuzz question B",
          created_by: trainerProfile!.user_id,
        })
        .select("id")
        .single(),
      svc
        .from("questions")
        .insert({
          category_id: ids.category,
          question_type: "essay",
          question_text: "Fuzz essay question",
          created_by: trainerProfile!.user_id,
        })
        .select("id")
        .single(),
    ]);
    ids.questionA = qa.data!.id;
    ids.questionB = qb.data!.id;
    ids.essayQuestion = essay.data!.id;

    const [optsA, optsB] = await Promise.all([
      svc
        .from("question_options")
        .insert({ question_id: ids.questionA, answer_text: "a1", is_correct: true, sort_order: 0 })
        .select("id")
        .single(),
      svc
        .from("question_options")
        .insert({ question_id: ids.questionB, answer_text: "b1", is_correct: true, sort_order: 0 })
        .select("id")
        .single(),
    ]);
    ids.optionOnA = optsA.data!.id;
    ids.optionOnB = optsB.data!.id;

    const quiz = await svc
      .from("quizzes")
      .insert({
        title: `CHAOS fuzz ${Date.now()}`,
        status: "published",
        passing_score: 50,
        max_attempts: 3,
        created_by: trainerProfile!.user_id,
      })
      .select("id")
      .single();
    ids.quiz = quiz.data!.id;

    await svc.from("quiz_questions").insert([
      { quiz_id: ids.quiz, question_id: ids.questionA, points: 1, sort_order: 0 },
      { quiz_id: ids.quiz, question_id: ids.questionB, points: 1, sort_order: 1 },
      { quiz_id: ids.quiz, question_id: ids.essayQuestion, points: 4, sort_order: 2 },
    ]);
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
    const questions = (
      payload.data as { questions: { id: string; type: string }[] }
    ).questions;
    ids.attemptQuestionA = questions[0].id;
    ids.essayAttemptQuestion = questions.find((q) => q.type === "essay")!.id;

    await sales.rpc("save_essay_answer", {
      target_attempt_question_id: ids.essayAttemptQuestion,
      essay: "answer for grading fuzz",
    });
    const { data: answerRow } = await svc
      .from("attempt_answers")
      .select("id")
      .eq("attempt_id", ids.attempt)
      .eq("attempt_question_id", ids.essayAttemptQuestion)
      .single();
    ids.essayAnswerId = answerRow!.id;
  });

  afterAll(async () => {
    if (!ids.quiz) return;
    await svc.from("quiz_attempts").delete().eq("quiz_id", ids.quiz);
    await svc.from("quizzes").delete().eq("id", ids.quiz);
    await svc.from("questions").delete().in("id", [ids.questionA, ids.questionB, ids.essayQuestion]);
    await svc.from("quiz_categories").delete().eq("id", ids.category);
    await sales?.auth.signOut();
    await trainer?.auth.signOut();
  });

  it("start_quiz_attempt rejects a non-existent quiz id cleanly", async () => {
    const { error } = await sales.rpc("start_quiz_attempt", {
      target_quiz_id: RANDOM_UUID,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/QUIZ_NOT_AVAILABLE/);
  });

  it("get_attempt_for_player rejects a non-existent attempt id cleanly", async () => {
    const { error } = await sales.rpc("get_attempt_for_player", {
      target_attempt_id: RANDOM_UUID,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/ATTEMPT_NOT_FOUND/);
  });

  it("save_objective_answer rejects an option that belongs to a different question", async () => {
    const { error } = await sales.rpc("save_objective_answer", {
      target_attempt_question_id: ids.attemptQuestionA,
      selected_option_ids: [ids.optionOnB],
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/OPTION_NOT_IN_QUESTION/);
  });

  it("save_objective_answer rejects a garbage attempt_question_id", async () => {
    const { error } = await sales.rpc("save_objective_answer", {
      target_attempt_question_id: RANDOM_UUID,
      selected_option_ids: [],
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/QUESTION_NOT_IN_ATTEMPT/);
  });

  it("save_essay_answer round-trips a very large payload without corrupting it", async () => {
    const huge = "x".repeat(500_000);
    const { error } = await sales.rpc("save_essay_answer", {
      target_attempt_question_id: ids.essayAttemptQuestion,
      essay: huge,
    });
    expect(error).toBeNull();
    const { data } = await svc
      .from("attempt_answers")
      .select("essay_answer")
      .eq("attempt_id", ids.attempt)
      .eq("attempt_question_id", ids.essayAttemptQuestion)
      .single();
    expect(data!.essay_answer.length).toBe(huge.length);
  });

  it("grade_essay_answer rejects a score above the question's points", async () => {
    const { error } = await trainer.rpc("grade_essay_answer", {
      target_answer_id: ids.essayAnswerId,
      score: 999,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/SCORE_OUT_OF_RANGE/);
  });

  it("grade_essay_answer rejects a negative score", async () => {
    const { error } = await trainer.rpc("grade_essay_answer", {
      target_answer_id: ids.essayAnswerId,
      score: -5,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/SCORE_OUT_OF_RANGE/);
  });

  it("grade_essay_answer rejects a garbage answer id", async () => {
    const { error } = await trainer.rpc("grade_essay_answer", {
      target_answer_id: RANDOM_UUID,
      score: 1,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/ANSWER_NOT_FOUND/);
  });

  it("admin_update_user rejects an unknown role and an unknown status", async () => {
    const { data: salesProfile } = await svc
      .from("profiles")
      .select("user_id")
      .eq("email", SEED_USERS.sales1.email)
      .single();

    const badRole = await trainer.rpc("admin_update_user", {
      target_user_id: salesProfile!.user_id,
      new_full_name: "Sales QA 01",
      new_role: "superuser",
      new_status: "active",
    });
    expect(badRole.error).not.toBeNull();
    expect(badRole.error!.message).toMatch(/INVALID_ROLE/);

    const badStatus = await trainer.rpc("admin_update_user", {
      target_user_id: salesProfile!.user_id,
      new_full_name: "Sales QA 01",
      new_role: "sales",
      new_status: "banned",
    });
    expect(badStatus.error).not.toBeNull();
    expect(badStatus.error!.message).toMatch(/INVALID_STATUS/);
  });
});
