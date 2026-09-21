import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AssessmentSession {
  id: string;
  quizId: string;
  token: string;
  label: string | null;
  candidateRoster: string[] | null;
  expiresAt: string | null;
  startsAt: string | null;
  maxCandidates: number | null;
  maxAttemptsOverride: number | null;
  candidatesUsed: number;
  status: "active" | "closed";
  createdAt: string;
  isDefaultLanding: boolean;
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
  const sessions = data ?? [];
  if (!sessions.length) return [];

  // Candidate count per session — distinct guest identities that have
  // started an attempt via each link. Reduced in JS from a flat row list,
  // same pattern already used for lookup maps in results/service.ts;
  // no new RPC needed since this is a plain owner-scoped read.
  const sessionIds = sessions.map((s) => s.id);
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("session_id, user_id")
    .in("session_id", sessionIds);
  const candidatesBySession = new Map<string, Set<string>>();
  for (const a of attempts ?? []) {
    const set = candidatesBySession.get(a.session_id) ?? new Set<string>();
    set.add(a.user_id);
    candidatesBySession.set(a.session_id, set);
  }

  return sessions.map((r) => ({
    id: r.id,
    quizId: r.quiz_id,
    token: r.token,
    label: r.label,
    candidateRoster: r.candidate_roster,
    expiresAt: r.expires_at,
    startsAt: r.starts_at,
    maxCandidates: r.max_candidates,
    maxAttemptsOverride: r.max_attempts_override,
    candidatesUsed: candidatesBySession.get(r.id)?.size ?? 0,
    status: r.status,
    createdAt: r.created_at,
    isDefaultLanding: r.is_default_landing,
  }));
}
