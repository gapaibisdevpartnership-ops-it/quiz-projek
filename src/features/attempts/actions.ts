"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/features/auth/service";
import { attemptErrorMessage } from "./errors";

export type StartResult =
  | { ok: true; attemptId: string }
  | { ok: false; error: string };

export async function startAttempt(quizId: string): Promise<StartResult> {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_quiz_attempt", {
    target_quiz_id: quizId,
  });
  if (error) return { ok: false, error: attemptErrorMessage(error.message) };
  return { ok: true, attemptId: data as string };
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveObjectiveAnswer(
  attemptQuestionId: string,
  selectedOptionIds: string[],
): Promise<SaveResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_objective_answer", {
    target_attempt_question_id: attemptQuestionId,
    selected_option_ids: selectedOptionIds,
  });
  if (error) return { ok: false, error: attemptErrorMessage(error.message) };
  return { ok: true };
}

export async function saveEssayAnswer(
  attemptQuestionId: string,
  essay: string,
): Promise<SaveResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_essay_answer", {
    target_attempt_question_id: attemptQuestionId,
    essay,
  });
  if (error) return { ok: false, error: attemptErrorMessage(error.message) };
  return { ok: true };
}

export async function markQuestionViewed(
  attemptQuestionId: string,
): Promise<{ ok: true; viewedAt: string } | { ok: false; error: string }> {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_question_viewed", {
    target_attempt_question_id: attemptQuestionId,
  });
  if (error) return { ok: false, error: attemptErrorMessage(error.message) };
  return { ok: true, viewedAt: data as string };
}

export async function lockAttemptQuestion(
  attemptQuestionId: string,
): Promise<SaveResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("lock_attempt_question", {
    target_attempt_question_id: attemptQuestionId,
  });
  if (error) return { ok: false, error: attemptErrorMessage(error.message) };
  return { ok: true };
}

export type SubmitResult =
  | { ok: true; status: string }
  | { ok: false; error: string };

export async function submitAttempt(
  attemptId: string,
  quizId: string,
): Promise<SubmitResult> {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz_attempt", {
    target_attempt_id: attemptId,
  });
  if (error) return { ok: false, error: attemptErrorMessage(error.message) };

  revalidatePath(`/quizzes/${quizId}`);
  revalidatePath("/history");
  return { ok: true, status: (data as { status: string }).status };
}
