"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/auth/service";
import {
  assignmentSchema,
  type AssignmentInput,
} from "@/lib/validation/assignment";

export type AssignmentMutationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function assignQuiz(
  input: AssignmentInput,
): Promise<AssignmentMutationResult> {
  const me = await requireAdmin();
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };

  const supabase = await createClient();
  const { error } = await supabase.from("quiz_assignments").insert({
    quiz_id: parsed.data.quizId,
    user_id: parsed.data.mode === "user" ? parsed.data.userId : null,
    team_id: parsed.data.mode === "team" ? parsed.data.teamId : null,
    assigned_by: me.userId,
    due_at: parsed.data.dueAt ?? null,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "This quiz is already assigned to that target."
          : error.message,
    };
  }

  revalidatePath(`/admin/quizzes/${parsed.data.quizId}`);
  return { ok: true };
}

export async function unassignQuiz(
  quizId: string,
  assignmentId: string,
): Promise<AssignmentMutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("quiz_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("quiz_id", quizId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/quizzes/${quizId}`);
  return { ok: true };
}
