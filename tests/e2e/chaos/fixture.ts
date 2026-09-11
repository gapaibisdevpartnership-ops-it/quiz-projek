import { createClient } from "@supabase/supabase-js";
import { SEED_USERS } from "../../helpers/seed";

/**
 * Seeds a throwaway quiz for the Layer-2 (client) chaos specs
 * (docs/CHAOS_TESTING_PLAN.md). Runs in the Playwright Node context (test
 * hooks), not the browser — same service-role pattern as
 * tests/integration/*.
 */

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set to run tests/e2e/chaos",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface ChaosQuiz {
  quizId: string;
  questionIds: string[];
  essayQuestionId: string | null;
  cleanup: () => Promise<void>;
}

export async function seedChaosQuiz(opts: {
  title: string;
  questionCount?: number;
  durationMinutes?: number | null;
  maxAttempts?: number;
  essay?: boolean;
}): Promise<ChaosQuiz> {
  const client = svc();
  const { data: trainerProfile } = await client
    .from("profiles")
    .select("user_id")
    .eq("email", SEED_USERS.trainer.email)
    .single();
  const { data: salesProfile } = await client
    .from("profiles")
    .select("user_id")
    .eq("email", SEED_USERS.sales1.email)
    .single();

  const cat = await client
    .from("quiz_categories")
    .insert({ name: `CHAOS e2e ${Date.now()}` })
    .select("id")
    .single();

  const questionIds: string[] = [];
  for (let i = 0; i < (opts.questionCount ?? 3); i++) {
    const q = await client
      .from("questions")
      .insert({
        category_id: cat.data!.id,
        question_type: "single_choice",
        question_text: `Chaos e2e question ${i + 1}`,
        created_by: trainerProfile!.user_id,
      })
      .select("id")
      .single();
    questionIds.push(q.data!.id);
    await client.from("question_options").insert([
      { question_id: q.data!.id, answer_text: "Correct", is_correct: true, sort_order: 0 },
      { question_id: q.data!.id, answer_text: "Wrong", is_correct: false, sort_order: 1 },
    ]);
  }

  let essayQuestionId: string | null = null;
  if (opts.essay) {
    const eq = await client
      .from("questions")
      .insert({
        category_id: cat.data!.id,
        question_type: "essay",
        question_text: "Chaos e2e essay",
        created_by: trainerProfile!.user_id,
      })
      .select("id")
      .single();
    essayQuestionId = eq.data!.id;
    questionIds.push(essayQuestionId);
  }

  const quiz = await client
    .from("quizzes")
    .insert({
      title: opts.title,
      status: "published",
      passing_score: 50,
      max_attempts: opts.maxAttempts ?? 3,
      duration_minutes: opts.durationMinutes ?? null,
      created_by: trainerProfile!.user_id,
    })
    .select("id")
    .single();

  await client.from("quiz_questions").insert(
    questionIds.map((id, i) => ({
      quiz_id: quiz.data!.id,
      question_id: id,
      points: 1,
      sort_order: i,
    })),
  );
  await client.from("quiz_assignments").insert({
    quiz_id: quiz.data!.id,
    user_id: salesProfile!.user_id,
    assigned_by: trainerProfile!.user_id,
  });

  return {
    quizId: quiz.data!.id,
    questionIds,
    essayQuestionId,
    cleanup: async () => {
      const s = svc();
      await s.from("quiz_attempts").delete().eq("quiz_id", quiz.data!.id);
      await s.from("quizzes").delete().eq("id", quiz.data!.id);
      await s.from("questions").delete().in("id", questionIds);
      await s.from("quiz_categories").delete().eq("id", cat.data!.id);
    },
  };
}
