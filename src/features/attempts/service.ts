import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PlayerData } from "./types";

export interface AttemptSummary {
  id: string;
  quizId: string;
  attemptNumber: number;
  status: "in_progress" | "pending_review" | "submitted" | "expired";
  startedAt: string;
  submittedAt: string | null;
  autoScore: number | null;
  finalScore: number | null;
  totalPoints: number | null;
  percentage: number | null;
  passed: boolean | null;
  requiresManualGrading: boolean;
}

interface AttemptRow {
  id: string;
  quiz_id: string;
  attempt_number: number;
  status: AttemptSummary["status"];
  started_at: string;
  submitted_at: string | null;
  auto_score: number | null;
  final_score: number | null;
  total_points: number | null;
  percentage: number | null;
  passed: boolean | null;
  requires_manual_grading: boolean;
}

function mapAttempt(r: AttemptRow): AttemptSummary {
  return {
    id: r.id,
    quizId: r.quiz_id,
    attemptNumber: r.attempt_number,
    status: r.status,
    startedAt: r.started_at,
    submittedAt: r.submitted_at,
    autoScore: r.auto_score,
    finalScore: r.final_score,
    totalPoints: r.total_points,
    percentage: r.percentage,
    passed: r.passed,
    requiresManualGrading: r.requires_manual_grading,
  };
}

export async function listMyAttempts(quizId?: string): Promise<AttemptSummary[]> {
  const supabase = await createClient();
  let q = supabase
    .from("quiz_attempts")
    .select("*")
    .order("attempt_number", { ascending: false });
  if (quizId) q = q.eq("quiz_id", quizId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as AttemptRow[]).map(mapAttempt);
}

export async function getMyAttempt(
  attemptId: string,
): Promise<AttemptSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle<AttemptRow>();
  if (error) throw error;
  return data ? mapAttempt(data) : null;
}

export async function getAttemptForPlayer(
  attemptId: string,
): Promise<PlayerData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attempt_for_player", {
    target_attempt_id: attemptId,
  });
  if (error) {
    if (error.message.includes("ATTEMPT_NOT_FOUND")) return null;
    throw error;
  }
  return data as PlayerData;
}
