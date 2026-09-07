"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/auth/service";
import {
  categorySchema,
  questionSchema,
  type QuestionInput,
} from "@/lib/validation/question";
import type { CategoryInput } from "@/lib/validation/question";

export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function firstError(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Invalid input.";
}

// Categories ---------------------------------------------------------

export async function createCategory(
  input: CategoryInput,
): Promise<MutationResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_categories")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      is_active: parsed.data.isActive,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/questions");
  return { ok: true, id: data.id };
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<MutationResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("quiz_categories")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      is_active: parsed.data.isActive,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/questions");
  return { ok: true, id };
}

// Questions --------------------------------------------------------

function questionRowFromInput(input: QuestionInput, createdBy?: string) {
  const row: Record<string, unknown> = {
    category_id: input.categoryId ?? null,
    question_type: input.questionType,
    question_text: input.questionText ? input.questionText : null,
    question_image_url: input.questionImageUrl ?? null,
    difficulty: input.difficulty ?? null,
    explanation: "explanation" in input ? input.explanation || null : null,
    sample_answer:
      input.questionType === "essay" ? input.sampleAnswer || null : null,
    grading_notes:
      input.questionType === "essay" ? input.gradingNotes || null : null,
  };
  if (createdBy) row.created_by = createdBy;
  return row;
}

function optionRows(questionId: string, input: QuestionInput) {
  if (input.questionType === "essay") return [];
  return input.options.map(
    (o: { answerText?: string; imageUrl?: string | null; isCorrect: boolean }, i: number) => ({
      question_id: questionId,
      answer_text: o.answerText ? o.answerText : null,
      image_url: o.imageUrl ?? null,
      is_correct: o.isCorrect,
      sort_order: i,
    }),
  );
}

export async function createQuestion(
  input: QuestionInput,
): Promise<MutationResult> {
  const profile = await requireAdmin();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };

  const supabase = await createClient();
  const { data: q, error } = await supabase
    .from("questions")
    .insert(questionRowFromInput(parsed.data, profile.userId))
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const rows = optionRows(q.id, parsed.data);
  if (rows.length) {
    const { error: oErr } = await supabase
      .from("question_options")
      .insert(rows);
    if (oErr) {
      // Roll back the orphaned question.
      await supabase.from("questions").delete().eq("id", q.id);
      return { ok: false, error: oErr.message };
    }
  }

  revalidatePath("/admin/questions");
  return { ok: true, id: q.id };
}

export async function updateQuestion(
  id: string,
  input: QuestionInput,
): Promise<MutationResult> {
  await requireAdmin();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .update(questionRowFromInput(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Replace options wholesale. Existing attempt snapshots are unaffected
  // (they are copied rows), so this is safe — docs/DOMAIN_RULES.md.
  const { error: delErr } = await supabase
    .from("question_options")
    .delete()
    .eq("question_id", id);
  if (delErr) return { ok: false, error: delErr.message };

  const rows = optionRows(id, parsed.data);
  if (rows.length) {
    const { error: insErr } = await supabase
      .from("question_options")
      .insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath("/admin/questions");
  revalidatePath(`/admin/questions/${id}/edit`);
  return { ok: true, id };
}

export async function setQuestionStatus(
  id: string,
  status: "active" | "archived",
): Promise<MutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/questions");
  return { ok: true, id };
}
