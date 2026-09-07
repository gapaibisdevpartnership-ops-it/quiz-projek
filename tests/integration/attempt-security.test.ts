import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasSupabaseEnv,
  serviceClient,
  signInAs,
} from "../helpers/supabase";
import { SEED_USERS } from "../helpers/seed";

/**
 * Phase 8 hardening — the docs/SECURITY_RLS.md "Security Tests" and
 * docs/TESTING_QA.md attempt-integrity checklist, exercised end to end against
 * a throwaway published quiz. Seeds with the service client, runs as the QA
 * sales users, cleans up after.
 */

const d = hasSupabaseEnv ? describe : describe.skip;

d("attempt security & integrity", () => {
  const svc = hasSupabaseEnv ? serviceClient() : (null as never);
  let sales1: SupabaseClient;
  let sales2: SupabaseClient;

  const ids = {
    category: "",
    mcQuestion: "",
    essayQuestion: "",
    correctOption: "",
    wrongOption: "",
    quiz: "",
    attempt1: "",
    attempt2: "",
  };
  const SALES1 = SEED_USERS.sales1;

  beforeAll(async () => {
    sales1 = await signInAs(SEED_USERS.sales1.email);
    sales2 = await signInAs(SEED_USERS.sales2.email);

    const { data: sales1Profile } = await svc
      .from("profiles")
      .select("user_id")
      .eq("email", SALES1.email)
      .single();
    const { data: trainerProfile } = await svc
      .from("profiles")
      .select("user_id")
      .eq("email", SEED_USERS.trainer.email)
      .single();

    const cat = await svc
      .from("quiz_categories")
      .insert({ name: `HARDENING ${Date.now()}` })
      .select("id")
      .single();
    ids.category = cat.data!.id;

    const mc = await svc
      .from("questions")
      .insert({
        category_id: ids.category,
        question_type: "single_choice",
        question_text: "ORIGINAL question text",
        created_by: trainerProfile!.user_id,
      })
      .select("id")
      .single();
    ids.mcQuestion = mc.data!.id;

    const opts = await svc
      .from("question_options")
      .insert([
        { question_id: ids.mcQuestion, answer_text: "right", is_correct: true, sort_order: 0 },
        { question_id: ids.mcQuestion, answer_text: "wrong", is_correct: false, sort_order: 1 },
      ])
      .select("id, is_correct");
    ids.correctOption = opts.data!.find((o) => o.is_correct)!.id;
    ids.wrongOption = opts.data!.find((o) => !o.is_correct)!.id;

    const essay = await svc
      .from("questions")
      .insert({
        category_id: ids.category,
        question_type: "essay",
        question_text: "Explain.",
        sample_answer: "SECRET sample answer",
        grading_notes: "SECRET grading notes",
        created_by: trainerProfile!.user_id,
      })
      .select("id")
      .single();
    ids.essayQuestion = essay.data!.id;

    const quiz = await svc
      .from("quizzes")
      .insert({
        title: `HARDENING quiz ${Date.now()}`,
        status: "published",
        passing_score: 50,
        max_attempts: 2,
        created_by: trainerProfile!.user_id,
      })
      .select("id")
      .single();
    ids.quiz = quiz.data!.id;

    await svc.from("quiz_questions").insert([
      { quiz_id: ids.quiz, question_id: ids.mcQuestion, points: 1, sort_order: 0 },
      { quiz_id: ids.quiz, question_id: ids.essayQuestion, points: 2, sort_order: 1 },
    ]);
    await svc.from("quiz_assignments").insert({
      quiz_id: ids.quiz,
      user_id: sales1Profile!.user_id,
      assigned_by: trainerProfile!.user_id,
    });
  });

  afterAll(async () => {
    if (!ids.quiz) return;
    await svc.from("quiz_attempts").delete().eq("quiz_id", ids.quiz);
    await svc.from("quizzes").delete().eq("id", ids.quiz);
    await svc.from("questions").delete().eq("id", ids.mcQuestion);
    await svc.from("questions").delete().eq("id", ids.essayQuestion);
    await svc.from("quiz_categories").delete().eq("id", ids.category);
    await sales1?.auth.signOut();
    await sales2?.auth.signOut();
  });

  it("sales sees the assigned published quiz", async () => {
    const { data } = await sales1.from("quizzes").select("id").eq("id", ids.quiz);
    expect(data).toHaveLength(1);
  });

  it("an unassigned sales user does NOT see the quiz", async () => {
    const { data } = await sales2.from("quizzes").select("id").eq("id", ids.quiz);
    expect(data ?? []).toHaveLength(0);
  });

  it("start_quiz_attempt creates an attempt", async () => {
    const { data, error } = await sales1.rpc("start_quiz_attempt", {
      target_quiz_id: ids.quiz,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    ids.attempt1 = data as string;
  });

  it("the player payload never contains answer keys", async () => {
    const { data, error } = await sales1.rpc("get_attempt_for_player", {
      target_attempt_id: ids.attempt1,
    });
    expect(error).toBeNull();
    const json = JSON.stringify(data);
    expect(json).not.toMatch(/is_correct|isCorrect/);
    expect(json).not.toMatch(/SECRET sample answer|SECRET grading notes/);
    expect(json).not.toMatch(/sample_answer|grading_notes|sampleAnswer/);
  });

  it("sales cannot read the snapshot option table directly", async () => {
    const { data } = await sales1
      .from("attempt_question_options")
      .select("id, is_correct");
    expect(data ?? []).toHaveLength(0);
  });

  it("sales cannot overwrite their own score", async () => {
    await sales1
      .from("quiz_attempts")
      .update({ percentage: 100, passed: true, final_score: 999 })
      .eq("id", ids.attempt1);
    const { data } = await sales1
      .from("quiz_attempts")
      .select("percentage, passed, final_score")
      .eq("id", ids.attempt1)
      .single();
    expect(data?.percentage).toBeNull();
    expect(data?.passed).toBeNull();
    expect(data?.final_score).toBeNull();
  });

  it("another sales user cannot read this attempt", async () => {
    const { data } = await sales2
      .from("quiz_attempts")
      .select("id")
      .eq("id", ids.attempt1);
    expect(data ?? []).toHaveLength(0);

    const { error } = await sales2.rpc("get_attempt_for_player", {
      target_attempt_id: ids.attempt1,
    });
    expect(error).not.toBeNull();
  });

  it("sales can save answers while in progress", async () => {
    const aqs = await sales1.rpc("get_attempt_for_player", {
      target_attempt_id: ids.attempt1,
    });
    type Q = { id: string; type: string; options: { id: string }[] };
    const questions = (aqs.data as { questions: Q[] }).questions;
    const mc = questions.find((q) => q.type === "single_choice")!;
    const essay = questions.find((q) => q.type === "essay")!;

    const r1 = await sales1.rpc("save_objective_answer", {
      target_attempt_question_id: mc.id,
      selected_option_ids: [mc.options[0].id],
    });
    expect(r1.error).toBeNull();

    const r2 = await sales1.rpc("save_essay_answer", {
      target_attempt_question_id: essay.id,
      essay: "my essay answer",
    });
    expect(r2.error).toBeNull();
  });

  it("submit is idempotent and yields pending_review (has essay)", async () => {
    const first = await sales1.rpc("submit_quiz_attempt", {
      target_attempt_id: ids.attempt1,
    });
    expect(first.error).toBeNull();
    expect((first.data as { status: string }).status).toBe("pending_review");

    const second = await sales1.rpc("submit_quiz_attempt", {
      target_attempt_id: ids.attempt1,
    });
    expect(second.error).toBeNull();
    expect((second.data as { alreadyFinalized: boolean }).alreadyFinalized).toBe(
      true,
    );
  });

  it("a submitted attempt is immutable to further answers", async () => {
    const aqs = await sales1.rpc("get_attempt_for_player", {
      target_attempt_id: ids.attempt1,
    });
    const q = (aqs.data as { questions: { id: string; type: string; options: { id: string }[] }[] })
      .questions.find((x) => x.type === "single_choice")!;
    const { error } = await sales1.rpc("save_objective_answer", {
      target_attempt_question_id: q.id,
      selected_option_ids: [q.options[0].id],
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/ATTEMPT_NOT_ACTIVE/);
  });

  it("sales cannot grade essays", async () => {
    const { error } = await sales1.rpc("grade_essay_answer", {
      target_answer_id: "00000000-0000-0000-0000-000000000000",
      score: 0,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/UNAUTHORIZED_GRADING/);
  });

  it("editing the source question does not change the attempt snapshot", async () => {
    await svc
      .from("questions")
      .update({ question_text: "EDITED after attempt" })
      .eq("id", ids.mcQuestion);

    const { data } = await sales1.rpc("get_attempt_for_player", {
      target_attempt_id: ids.attempt1,
    });
    const json = JSON.stringify(data);
    expect(json).toMatch(/ORIGINAL question text/);
    expect(json).not.toMatch(/EDITED after attempt/);
  });

  it("attempt numbers increment and max_attempts is enforced", async () => {
    const second = await sales1.rpc("start_quiz_attempt", {
      target_quiz_id: ids.quiz,
    });
    expect(second.error).toBeNull();
    ids.attempt2 = second.data as string;

    const { data: n } = await sales1
      .from("quiz_attempts")
      .select("attempt_number")
      .eq("id", ids.attempt2)
      .single();
    expect(n?.attempt_number).toBe(2);

    // Finish #2 so a third start is limited, not resumed.
    await sales1.rpc("submit_quiz_attempt", { target_attempt_id: ids.attempt2 });
    const third = await sales1.rpc("start_quiz_attempt", {
      target_quiz_id: ids.quiz,
    });
    expect(third.error).not.toBeNull();
    expect(third.error!.message).toMatch(/ATTEMPT_LIMIT_REACHED/);
  });

  it("an archived quiz keeps its history readable", async () => {
    await svc.from("quizzes").update({ status: "archived" }).eq("id", ids.quiz);
    const { data, error } = await sales1.rpc("get_attempt_for_player", {
      target_attempt_id: ids.attempt1,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    await svc.from("quizzes").update({ status: "published" }).eq("id", ids.quiz);
  });
});
