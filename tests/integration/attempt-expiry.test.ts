import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, serviceClient, signInAs } from "../helpers/supabase";
import { SEED_USERS } from "../helpers/seed";

/**
 * Phase 8 follow-up — the `expire_stale_attempts` sweep
 * (supabase/migrations/20260907150000_attempt_expiry.sql).
 *
 * Seeds two throwaway published quizzes with a 30-minute duration, starts
 * attempts as Sales QA 01, back-dates `started_at` past the deadline with the
 * service client, then runs the sweep and asserts the finalisation.
 */

const d = hasSupabaseEnv ? describe : describe.skip;

const MIN = 60 * 1000;

d("expire_stale_attempts", () => {
  const svc = hasSupabaseEnv ? serviceClient() : (null as never);
  let sales: SupabaseClient;

  const ids = {
    category: "",
    objQuestion: "",
    essayQuestion: "",
    objQuiz: "",
    essayQuiz: "",
    expiredAttempt: "",
    freshAttempt: "",
    essayAttempt: "",
  };

  async function profileId(email: string) {
    const { data } = await svc
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .single();
    return data!.user_id as string;
  }

  beforeAll(async () => {
    sales = await signInAs(SEED_USERS.sales1.email);
    const salesId = await profileId(SEED_USERS.sales1.email);
    const trainerId = await profileId(SEED_USERS.trainer.email);

    const cat = await svc
      .from("quiz_categories")
      .insert({ name: `EXPIRY ${Date.now()}` })
      .select("id")
      .single();
    ids.category = cat.data!.id;

    const obj = await svc
      .from("questions")
      .insert({
        category_id: ids.category,
        question_type: "single_choice",
        question_text: "2 + 2 = ?",
        created_by: trainerId,
      })
      .select("id")
      .single();
    ids.objQuestion = obj.data!.id;

    await svc.from("question_options").insert([
      { question_id: ids.objQuestion, answer_text: "4", is_correct: true, sort_order: 0 },
      { question_id: ids.objQuestion, answer_text: "5", is_correct: false, sort_order: 1 },
    ]);

    const essay = await svc
      .from("questions")
      .insert({
        category_id: ids.category,
        question_type: "essay",
        question_text: "Discuss.",
        created_by: trainerId,
      })
      .select("id")
      .single();
    ids.essayQuestion = essay.data!.id;

    for (const key of ["objQuiz", "essayQuiz"] as const) {
      const quiz = await svc
        .from("quizzes")
        .insert({
          title: `EXPIRY ${key} ${Date.now()}`,
          status: "published",
          passing_score: 50,
          max_attempts: 3,
          duration_minutes: 30,
          created_by: trainerId,
        })
        .select("id")
        .single();
      ids[key] = quiz.data!.id;
      await svc.from("quiz_assignments").insert({
        quiz_id: quiz.data!.id,
        user_id: salesId,
        assigned_by: trainerId,
      });
    }

    await svc.from("quiz_questions").insert([
      { quiz_id: ids.objQuiz, question_id: ids.objQuestion, points: 10, sort_order: 0 },
      { quiz_id: ids.essayQuiz, question_id: ids.essayQuestion, points: 10, sort_order: 0 },
    ]);
  });

  afterAll(async () => {
    for (const q of [ids.objQuiz, ids.essayQuiz]) {
      if (!q) continue;
      await svc.from("quiz_attempts").delete().eq("quiz_id", q);
      await svc.from("quizzes").delete().eq("id", q);
    }
    await svc.from("questions").delete().eq("id", ids.objQuestion);
    await svc.from("questions").delete().eq("id", ids.essayQuestion);
    await svc.from("quiz_categories").delete().eq("id", ids.category);
    await sales?.auth.signOut();
  });

  it("finalises an objective attempt past its deadline, scoring what was answered", async () => {
    const start = await sales.rpc("start_quiz_attempt", { target_quiz_id: ids.objQuiz });
    expect(start.error).toBeNull();
    ids.expiredAttempt = start.data as string;

    const payload = await sales.rpc("get_attempt_for_player", {
      target_attempt_id: ids.expiredAttempt,
    });
    const q = (
      payload.data as {
        questions: { id: string; options: { id: string; text: string }[] }[];
      }
    ).questions[0];
    // The player payload never exposes is_correct; pick the snapshot option by
    // its text (the correct answer to "2 + 2 = ?").
    const correctSnapshotOption = q.options.find((o) => o.text === "4")!;
    const saved = await sales.rpc("save_objective_answer", {
      target_attempt_question_id: q.id,
      selected_option_ids: [correctSnapshotOption.id],
    });
    expect(saved.error).toBeNull();

    // Back-date so started_at + 30min is comfortably in the past.
    const startedAt = new Date(Date.now() - 45 * MIN).toISOString();
    await svc.from("quiz_attempts").update({ started_at: startedAt }).eq("id", ids.expiredAttempt);

    const swept = await svc.rpc("expire_stale_attempts");
    expect(swept.error).toBeNull();
    expect(swept.data as number).toBeGreaterThanOrEqual(1);

    const { data } = await svc
      .from("quiz_attempts")
      .select("status, percentage, passed, auto_score, final_score, submitted_at, time_spent_seconds")
      .eq("id", ids.expiredAttempt)
      .single();
    expect(data!.status).toBe("submitted");
    expect(Number(data!.auto_score)).toBe(10);
    expect(Number(data!.percentage)).toBe(100);
    expect(data!.passed).toBe(true);
    // Stamped at the deadline (started_at + 30min), not "now".
    expect(Number(data!.time_spent_seconds)).toBe(30 * 60);
    expect(new Date(data!.submitted_at as string).getTime()).toBeLessThan(Date.now() - 10 * MIN);
  });

  it("routes an essay attempt to pending_review", async () => {
    const start = await sales.rpc("start_quiz_attempt", { target_quiz_id: ids.essayQuiz });
    ids.essayAttempt = start.data as string;
    await svc
      .from("quiz_attempts")
      .update({ started_at: new Date(Date.now() - 45 * MIN).toISOString() })
      .eq("id", ids.essayAttempt);

    await svc.rpc("expire_stale_attempts");

    const { data } = await svc
      .from("quiz_attempts")
      .select("status, requires_manual_grading")
      .eq("id", ids.essayAttempt)
      .single();
    expect(data!.status).toBe("pending_review");
    expect(data!.requires_manual_grading).toBe(true);
  });

  it("leaves an attempt whose deadline has not passed untouched", async () => {
    const start = await sales.rpc("start_quiz_attempt", { target_quiz_id: ids.objQuiz });
    ids.freshAttempt = start.data as string;
    expect(ids.freshAttempt).not.toBe(ids.expiredAttempt);

    await svc.rpc("expire_stale_attempts");

    const { data } = await svc
      .from("quiz_attempts")
      .select("status")
      .eq("id", ids.freshAttempt)
      .single();
    expect(data!.status).toBe("in_progress");
  });
});
