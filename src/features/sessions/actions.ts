"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/auth/service";
import {
  createSessionSchema,
  type CreateSessionInput,
} from "@/lib/validation/session";
import { parseRoster } from "@/features/sessions/roster";

export type SessionMutationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createSession(
  input: CreateSessionInput,
): Promise<SessionMutationResult> {
  const me = await requireAdmin();
  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };

  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString()
    : null;

  const supabase = await createClient();
  const { error } = await supabase.from("assessment_sessions").insert({
    quiz_id: parsed.data.quizId,
    label: parsed.data.label || null,
    expires_at: expiresAt,
    candidate_roster: parseRoster(parsed.data.rosterText),
    created_by: me.userId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/quizzes/${parsed.data.quizId}`);
  return { ok: true };
}

export async function closeSession(
  quizId: string,
  sessionId: string,
): Promise<SessionMutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("assessment_sessions")
    .update({ status: "closed" })
    .eq("id", sessionId)
    .eq("quiz_id", quizId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/quizzes/${quizId}`);
  return { ok: true };
}

export async function reopenSession(
  quizId: string,
  sessionId: string,
): Promise<SessionMutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("assessment_sessions")
    .update({ status: "active" })
    .eq("id", sessionId)
    .eq("quiz_id", quizId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/quizzes/${quizId}`);
  return { ok: true };
}
