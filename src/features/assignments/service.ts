import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  mapAssignment,
  mapQuiz,
  type Assignment,
  type AssignmentRow,
  type Quiz,
  type QuizRow,
} from "@/types/domain";

export interface ResolvedAssignment extends Assignment {
  targetLabel: string;
}

/** Assignments for one quiz, with a human label for the target. */
export async function listQuizAssignments(
  quizId: string,
): Promise<ResolvedAssignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_assignments")
    .select("*")
    .eq("quiz_id", quizId)
    .order("assigned_at", { ascending: false });
  if (error) throw error;

  const rows = (data as AssignmentRow[]).map(mapAssignment);
  const userIds = rows.flatMap((a) => (a.userId ? [a.userId] : []));
  const teamIds = rows.flatMap((a) => (a.teamId ? [a.teamId] : []));

  const [{ data: users }, { data: teams }] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string; email: string }[] }),
    teamIds.length
      ? supabase.from("teams").select("id, name").in("id", teamIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const userLabel = new Map(
    (users ?? []).map((u) => [u.user_id, u.full_name || u.email]),
  );
  const teamLabel = new Map((teams ?? []).map((t) => [t.id, t.name]));

  return rows.map((a) => ({
    ...a,
    targetLabel: a.userId
      ? `${userLabel.get(a.userId) ?? "Unknown user"}`
      : `Team: ${teamLabel.get(a.teamId!) ?? "Unknown team"}`,
  }));
}

/**
 * Quizzes visible to the current sales user: RLS already limits `quizzes` to
 * published quizzes assigned to them (directly or by team).
 */
export async function listMyAssignedQuizzes(): Promise<Quiz[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("status", "published")
    .order("end_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data as QuizRow[]).map(mapQuiz);
}

export async function getMyAssignedQuiz(quizId: string): Promise<Quiz | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .eq("status", "published")
    .maybeSingle<QuizRow>();
  if (error) throw error;
  return data ? mapQuiz(data) : null;
}
