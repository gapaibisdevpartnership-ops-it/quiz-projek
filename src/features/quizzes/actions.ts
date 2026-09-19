"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireSuperAdmin } from "@/features/auth/service";
import {
  quizQuestionPointsSchema,
  quizSettingsSchema,
  type QuizSettingsInput,
} from "@/lib/validation/quiz";
import type { QuizStatus } from "@/lib/constants";

export type QuizMutationResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function rowFromSettings(input: QuizSettingsInput) {
  return {
    title: input.title,
    description: input.description || null,
    instructions: input.instructions || null,
    category_id: input.categoryId ?? null,
    cover_image_url: input.coverImageUrl ?? null,
    duration_minutes: input.durationMinutes ?? null,
    passing_score: input.passingScore,
    max_attempts: input.maxAttempts,
    shuffle_questions: input.shuffleQuestions,
    shuffle_answers: input.shuffleAnswers,
    show_result: input.showResult,
    show_correct_answer: input.showCorrectAnswer,
    start_at: input.startAt ?? null,
    end_at: input.endAt ?? null,
  };
}

export async function createQuiz(
  input: QuizSettingsInput,
): Promise<QuizMutationResult> {
  const profile = await requireAdmin();
  const parsed = quizSettingsSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .insert({ ...rowFromSettings(parsed.data), created_by: profile.userId })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/quizzes");
  return { ok: true, id: data.id };
}

export async function updateQuiz(
  id: string,
  input: QuizSettingsInput,
): Promise<QuizMutationResult> {
  await requireAdmin();
  const parsed = quizSettingsSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("quizzes")
    .update(rowFromSettings(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/quizzes");
  revalidatePath(`/admin/quizzes/${id}`);
  return { ok: true, id };
}

export async function setQuizStatus(
  id: string,
  status: QuizStatus,
): Promise<QuizMutationResult> {
  await requireAdmin();
  const supabase = await createClient();

  if (status === "published") {
    const { count, error: cErr } = await supabase
      .from("quiz_questions")
      .select("id", { count: "exact", head: true })
      .eq("quiz_id", id);
    if (cErr) return { ok: false, error: cErr.message };
    if (!count) {
      return {
        ok: false,
        error: "Add at least one question before publishing.",
      };
    }
  }

  const { error } = await supabase
    .from("quizzes")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/quizzes");
  revalidatePath(`/admin/quizzes/${id}`);
  return { ok: true, id };
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Permanently delete a quiz — super_admin only
 * (docs/HARD_DELETE_ENTITIES_PLAN.md). `quiz_attempts.quiz_id` is `on
 * delete restrict`, so Postgres blocks this while the quiz has ANY
 * attempt, including guest/session-link ones (23503) — caught below with
 * a friendly message. `quiz_questions`/`quiz_assignments`/
 * `assessment_sessions` all cascade harmlessly (join rows, or a link that
 * was never actually used).
 */
export async function deleteQuizPermanently(id: string): Promise<DeleteResult> {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("quizzes").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error: "This quiz has attempt history and can't be deleted — archive it instead.",
      };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/admin/quizzes");
  return { ok: true };
}

// --- quiz_questions -------------------------------------------------

export async function addQuestionToQuiz(
  quizId: string,
  questionId: string,
): Promise<QuizMutationResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("quiz_questions")
    .select("sort_order")
    .eq("quiz_id", quizId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();

  const { error } = await supabase.from("quiz_questions").insert({
    quiz_id: quizId,
    question_id: questionId,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "That question is already in this quiz."
          : error.message,
    };
  }

  revalidatePath(`/admin/quizzes/${quizId}/questions`);
  return { ok: true, id: quizId };
}

export async function removeQuizQuestion(
  quizId: string,
  quizQuestionId: string,
): Promise<QuizMutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("quiz_questions")
    .delete()
    .eq("id", quizQuestionId)
    .eq("quiz_id", quizId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/quizzes/${quizId}/questions`);
  return { ok: true, id: quizId };
}

export async function setQuizQuestionPoints(
  quizId: string,
  quizQuestionId: string,
  points: number,
): Promise<QuizMutationResult> {
  await requireAdmin();
  const parsed = quizQuestionPointsSchema.safeParse({ points });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("quiz_questions")
    .update({ points: parsed.data.points })
    .eq("id", quizQuestionId)
    .eq("quiz_id", quizId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/quizzes/${quizId}/questions`);
  return { ok: true, id: quizId };
}

/** Persist a new order. `orderedIds` are quiz_questions.id in the desired order. */
export async function reorderQuizQuestions(
  quizId: string,
  orderedIds: string[],
): Promise<QuizMutationResult> {
  await requireAdmin();
  const supabase = await createClient();

  const updates = orderedIds.map((id, index) =>
    supabase
      .from("quiz_questions")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("quiz_id", quizId),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

  revalidatePath(`/admin/quizzes/${quizId}/questions`);
  return { ok: true, id: quizId };
}
