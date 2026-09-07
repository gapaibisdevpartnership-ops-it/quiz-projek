"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/auth/service";

export type GradeResult =
  | { ok: true; status: string }
  | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  UNAUTHORIZED_GRADING: "You are not allowed to grade essays.",
  ANSWER_NOT_FOUND: "That answer no longer exists.",
  NOT_AN_ESSAY: "That question is not an essay.",
  SCORE_OUT_OF_RANGE: "Score must be between 0 and the question's points.",
};

function message(raw: string | undefined): string {
  if (!raw) return "Grading failed.";
  for (const k of Object.keys(MESSAGES)) if (raw.includes(k)) return MESSAGES[k];
  return "Grading failed.";
}

export async function gradeEssay(
  answerId: string,
  score: number,
  feedback: string,
  attemptId: string,
): Promise<GradeResult> {
  await requireAdmin();
  if (!Number.isFinite(score) || score < 0) {
    return { ok: false, error: "Enter a score of 0 or more." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("grade_essay_answer", {
    target_answer_id: answerId,
    score,
    feedback: feedback || null,
  });
  if (error) return { ok: false, error: message(error.message) };

  revalidatePath("/admin/grading");
  revalidatePath(`/admin/results/${attemptId}`);
  return { ok: true, status: (data as { status: string }).status };
}
