import "server-only";
import { createClient } from "@/lib/supabase/server";
import { round1 as round } from "./aggregate";

export interface AdminKpis {
  totalSales: number;
  activeQuizzes: number;
  completedAttempts: number;
  pendingReviews: number;
  averageScore: number | null;
  passRate: number | null;
}

export async function getAdminKpis(): Promise<AdminKpis> {
  const supabase = await createClient();

  const [sales, quizzes, attempts] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "sales")
      .eq("status", "active"),
    supabase
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("quiz_attempts")
      .select("status, percentage, passed"),
  ]);

  const rows = (attempts.data ?? []) as {
    status: string;
    percentage: number | null;
    passed: boolean | null;
  }[];
  const finished = rows.filter((r) => r.status === "submitted");
  const scored = finished.filter((r) => r.percentage != null);

  return {
    totalSales: sales.count ?? 0,
    activeQuizzes: quizzes.count ?? 0,
    completedAttempts: finished.length,
    pendingReviews: rows.filter((r) => r.status === "pending_review").length,
    averageScore: scored.length
      ? round(
          scored.reduce((s, r) => s + (r.percentage as number), 0) /
            scored.length,
        )
      : null,
    passRate: finished.length
      ? round(
          (finished.filter((r) => r.passed).length / finished.length) * 100,
        )
      : null,
  };
}

export interface QuizAnalyticsRow {
  quizId: string;
  title: string;
  status: string;
  attempts: number;
  finished: number;
  pending: number;
  avgPercentage: number | null;
  passRate: number | null;
}

export async function getQuizAnalytics(): Promise<QuizAnalyticsRow[]> {
  const supabase = await createClient();
  const [{ data: quizzes }, { data: attempts }] = await Promise.all([
    supabase.from("quizzes").select("id, title, status"),
    supabase.from("quiz_attempts").select("quiz_id, status, percentage, passed"),
  ]);

  const byQuiz = new Map<
    string,
    { status: string; percentage: number | null; passed: boolean | null }[]
  >();
  for (const a of (attempts ?? []) as {
    quiz_id: string;
    status: string;
    percentage: number | null;
    passed: boolean | null;
  }[]) {
    const list = byQuiz.get(a.quiz_id) ?? [];
    list.push(a);
    byQuiz.set(a.quiz_id, list);
  }

  return ((quizzes ?? []) as { id: string; title: string; status: string }[])
    .map((q) => {
      const list = byQuiz.get(q.id) ?? [];
      const finished = list.filter((a) => a.status === "submitted");
      const scored = finished.filter((a) => a.percentage != null);
      return {
        quizId: q.id,
        title: q.title,
        status: q.status,
        attempts: list.length,
        finished: finished.length,
        pending: list.filter((a) => a.status === "pending_review").length,
        avgPercentage: scored.length
          ? round(
              scored.reduce((s, a) => s + (a.percentage as number), 0) /
                scored.length,
            )
          : null,
        passRate: finished.length
          ? round(
              (finished.filter((a) => a.passed).length / finished.length) * 100,
            )
          : null,
      };
    })
    .sort((a, b) => b.attempts - a.attempts);
}

export interface SalesPerformanceRow {
  userId: string;
  name: string;
  attempts: number;
  avgPercentage: number | null;
  passed: number;
}

export async function getSalesPerformance(): Promise<SalesPerformanceRow[]> {
  const supabase = await createClient();
  const [{ data: profiles }, { data: attempts }] = await Promise.all([
    // TODO: re-add `.eq("is_guest", false)` once
    // supabase/migrations/20260918090000_public_session_link.sql is applied
    // to production (docs/PUBLIC_SESSION_LINK_PLAN.md).
    supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .eq("role", "sales"),
    supabase
      .from("quiz_attempts")
      .select("user_id, status, percentage, passed")
      .eq("status", "submitted"),
  ]);

  const byUser = new Map<string, { percentage: number | null; passed: boolean | null }[]>();
  for (const a of (attempts ?? []) as {
    user_id: string;
    percentage: number | null;
    passed: boolean | null;
  }[]) {
    const list = byUser.get(a.user_id) ?? [];
    list.push(a);
    byUser.set(a.user_id, list);
  }

  return ((profiles ?? []) as {
    user_id: string;
    full_name: string;
    email: string;
  }[])
    .map((p) => {
      const list = byUser.get(p.user_id) ?? [];
      const scored = list.filter((a) => a.percentage != null);
      return {
        userId: p.user_id,
        name: p.full_name || p.email,
        attempts: list.length,
        avgPercentage: scored.length
          ? round(
              scored.reduce((s, a) => s + (a.percentage as number), 0) /
                scored.length,
            )
          : null,
        passed: list.filter((a) => a.passed).length,
      };
    })
    .sort((a, b) => (b.avgPercentage ?? -1) - (a.avgPercentage ?? -1));
}

export interface QuestionStat {
  questionText: string | null;
  type: string;
  answered: number;
  correct: number;
  correctRate: number | null;
}

/** Objective correct-rate per source question across one quiz's attempts. */
export async function getQuestionAnalytics(
  quizId: string,
): Promise<QuestionStat[]> {
  const supabase = await createClient();

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id")
    .eq("quiz_id", quizId);
  const attemptIds = (attempts ?? []).map((a) => a.id as string);
  if (!attemptIds.length) return [];

  const [{ data: aqs }, { data: opts }, { data: answers }, { data: answerOpts }] =
    await Promise.all([
      supabase
        .from("attempt_questions")
        .select("id, source_question_id, question_type, question_text, sort_order")
        .in("attempt_id", attemptIds)
        .neq("question_type", "essay"),
      supabase
        .from("attempt_question_options")
        .select("id, attempt_question_id, is_correct"),
      supabase
        .from("attempt_answers")
        .select("id, attempt_question_id")
        .in("attempt_id", attemptIds),
      supabase
        .from("attempt_answer_options")
        .select("attempt_answer_id, attempt_question_option_id"),
    ]);

  const optByAq = new Map<string, { id: string; is_correct: boolean }[]>();
  for (const o of (opts ?? []) as {
    id: string;
    attempt_question_id: string;
    is_correct: boolean;
  }[]) {
    const l = optByAq.get(o.attempt_question_id) ?? [];
    l.push(o);
    optByAq.set(o.attempt_question_id, l);
  }
  const answerById = new Map(
    (answers ?? []).map((a) => [a.id as string, a.attempt_question_id as string]),
  );
  const selByAnswer = new Map<string, Set<string>>();
  for (const ao of (answerOpts ?? []) as {
    attempt_answer_id: string;
    attempt_question_option_id: string;
  }[]) {
    const set = selByAnswer.get(ao.attempt_answer_id) ?? new Set<string>();
    set.add(ao.attempt_question_option_id);
    selByAnswer.set(ao.attempt_answer_id, set);
  }
  const selByAq = new Map<string, Set<string>>();
  for (const [answerId, aqId] of answerById) {
    selByAq.set(aqId, selByAnswer.get(answerId) ?? new Set());
  }

  // Group snapshot questions by their source question.
  const groups = new Map<
    string,
    { text: string | null; type: string; answered: number; correct: number }
  >();
  for (const aq of (aqs ?? []) as {
    id: string;
    source_question_id: string | null;
    question_type: string;
    question_text: string | null;
  }[]) {
    const key = aq.source_question_id ?? aq.id;
    const g =
      groups.get(key) ??
      { text: aq.question_text, type: aq.question_type, answered: 0, correct: 0 };
    const selected = selByAq.get(aq.id);
    if (selected && selected.size > 0) {
      g.answered += 1;
      const qOpts = optByAq.get(aq.id) ?? [];
      const nCorrect = qOpts.filter((o) => o.is_correct).length;
      const selCorrect = qOpts.filter(
        (o) => o.is_correct && selected.has(o.id),
      ).length;
      if (nCorrect > 0 && selCorrect === nCorrect && selected.size === nCorrect)
        g.correct += 1;
    }
    groups.set(key, g);
  }

  return [...groups.values()].map((g) => ({
    questionText: g.text,
    type: g.type,
    answered: g.answered,
    correct: g.correct,
    correctRate: g.answered ? round((g.correct / g.answered) * 100) : null,
  }));
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  attempts: number;
  avgPercentage: number | null;
  passedCount: number;
}

export async function getLeaderboard(limit = 20): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leaderboard", {
    row_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as {
    user_id: string;
    full_name: string;
    attempts: number;
    avg_percentage: number | null;
    passed_count: number;
  }[]).map((r) => ({
    userId: r.user_id,
    name: r.full_name,
    attempts: Number(r.attempts),
    avgPercentage: r.avg_percentage != null ? Number(r.avg_percentage) : null,
    passedCount: Number(r.passed_count),
  }));
}
