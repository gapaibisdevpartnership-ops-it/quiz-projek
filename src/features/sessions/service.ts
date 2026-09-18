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
  if (error) {
    // TODO: remove this guard once
    // supabase/migrations/20260918090000_public_session_link.sql is applied
    // to production (docs/PUBLIC_SESSION_LINK_PLAN.md) — until then the
    // table doesn't exist yet (PostgREST reports this as "PGRST205", not
    // Postgres's raw "42P01", since it's PostgREST's schema-cache lookup
    // that fails, not the query itself), and the quiz overview page that
    // renders the Session Links card must not break for admins over it.
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }
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
