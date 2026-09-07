import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface GradingQueueItem {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  userName: string;
  submittedAt: string | null;
  essaysTotal: number;
  essaysGraded: number;
}

export async function listGradingQueue(): Promise<GradingQueueItem[]> {
  const supabase = await createClient();

  const { data: attempts, error } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_id, user_id, submitted_at")
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: true });
  if (error) throw error;
  const rows = (attempts ?? []) as {
    id: string;
    quiz_id: string;
    user_id: string;
    submitted_at: string | null;
  }[];
  if (rows.length === 0) return [];

  const quizIds = [...new Set(rows.map((r) => r.quiz_id))];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const attemptIds = rows.map((r) => r.id);

  const [{ data: quizzes }, { data: profiles }, { data: eq }, { data: ans }] =
    await Promise.all([
      supabase.from("quizzes").select("id, title").in("id", quizIds),
      supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds),
      supabase
        .from("attempt_questions")
        .select("attempt_id")
        .eq("question_type", "essay")
        .in("attempt_id", attemptIds),
      supabase
        .from("attempt_answers")
        .select("attempt_id, manual_score, attempt_question_id")
        .in("attempt_id", attemptIds),
    ]);

  const title = new Map((quizzes ?? []).map((q) => [q.id, q.title]));
  const name = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.full_name || p.email]),
  );
  const essaysByAttempt = new Map<string, number>();
  for (const row of eq ?? [])
    essaysByAttempt.set(
      row.attempt_id,
      (essaysByAttempt.get(row.attempt_id) ?? 0) + 1,
    );
  const gradedByAttempt = new Map<string, number>();
  for (const row of ans ?? []) {
    if (row.manual_score != null)
      gradedByAttempt.set(
        row.attempt_id,
        (gradedByAttempt.get(row.attempt_id) ?? 0) + 1,
      );
  }

  return rows.map((r) => ({
    attemptId: r.id,
    quizId: r.quiz_id,
    quizTitle: title.get(r.quiz_id) ?? "Quiz",
    userName: name.get(r.user_id) ?? "User",
    submittedAt: r.submitted_at,
    essaysTotal: essaysByAttempt.get(r.id) ?? 0,
    essaysGraded: gradedByAttempt.get(r.id) ?? 0,
  }));
}
