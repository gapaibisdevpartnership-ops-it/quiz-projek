import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AssessmentSession {
  id: string;
  quizId: string;
  token: string;
  label: string | null;
  candidateRoster: string[] | null;
  expiresAt: string | null;
  status: "active" | "closed";
  createdAt: string;
}

export async function listSessionsForQuiz(
  quizId: string,
): Promise<AssessmentSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessment_sessions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    quizId: r.quiz_id,
    token: r.token,
    label: r.label,
    candidateRoster: r.candidate_roster,
    expiresAt: r.expires_at,
    status: r.status,
    createdAt: r.created_at,
  }));
}
