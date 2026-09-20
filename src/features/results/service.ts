import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { QuestionType } from "@/lib/constants";
import { evaluateAttemptSchedule, type ScheduleStatus } from "@/lib/schedule";

export interface AttemptListRow {
  id: string;
  quizId: string;
  quizTitle: string;
  userName: string;
  isGuest: boolean;
  attemptNumber: number;
  status: string;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  startedAt: string | null;
  scheduleStatus: ScheduleStatus;
}

const ATTEMPT_COLUMNS =
  "id, quiz_id, user_id, attempt_number, status, percentage, passed, submitted_at, started_at, session_id";

/** Joins quiz title + user name/guest flag onto raw attempt rows. Shared by
 * every list query below so they don't each re-implement the two lookups. */
async function hydrateAttempts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Record<string, unknown>[],
): Promise<AttemptListRow[]> {
  if (!rows.length) return [];

  const quizIds = [...new Set(rows.map((r) => r.quiz_id as string))];
  const userIds = [...new Set(rows.map((r) => r.user_id as string))];
  const sessionIds = [
    ...new Set(
      rows
        .map((r) => r.session_id as string | null)
        .filter((id): id is string => id != null),
    ),
  ];
  const [{ data: quizzes }, { data: profiles }, { data: sessions }] =
    await Promise.all([
      supabase.from("quizzes").select("id, title, start_at, end_at").in("id", quizIds),
      supabase
        .from("profiles")
        .select("user_id, full_name, email, is_guest")
        .in("user_id", userIds),
      sessionIds.length
        ? supabase
            .from("assessment_sessions")
            .select("id, starts_at, expires_at")
            .in("id", sessionIds)
        : Promise.resolve({ data: [] as { id: string; starts_at: string | null; expires_at: string | null }[] }),
    ]);
  const title = new Map((quizzes ?? []).map((q) => [q.id, q.title]));
  const quizWindow = new Map(
    (quizzes ?? []).map((q) => [
      q.id,
      { startsAt: q.start_at as string | null, endsAt: q.end_at as string | null },
    ]),
  );
  const sessionWindow = new Map(
    (sessions ?? []).map((s) => [
      s.id,
      { startsAt: s.starts_at, endsAt: s.expires_at },
    ]),
  );
  const name = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.full_name || p.email]),
  );
  const guest = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.is_guest as boolean]),
  );

  return rows.map((r) => {
    const sessionId = r.session_id as string | null;
    const startedAt = (r.started_at as string | null) ?? null;
    return {
      id: r.id as string,
      quizId: r.quiz_id as string,
      quizTitle: title.get(r.quiz_id as string) ?? "Quiz",
      userName: name.get(r.user_id as string) ?? "User",
      isGuest: guest.get(r.user_id as string) ?? false,
      attemptNumber: r.attempt_number as number,
      status: r.status as string,
      percentage: (r.percentage as number | null) ?? null,
      passed: (r.passed as boolean | null) ?? null,
      submittedAt: (r.submitted_at as string | null) ?? null,
      startedAt,
      scheduleStatus: evaluateAttemptSchedule({
        startedAt,
        session: sessionId ? (sessionWindow.get(sessionId) ?? null) : null,
        quiz: quizWindow.get(r.quiz_id as string) ?? null,
      }),
    };
  });
}

export async function listAllAttempts(): Promise<AttemptListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select(ATTEMPT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return hydrateAttempts(supabase, (data ?? []) as Record<string, unknown>[]);
}

/** Most recently finalized attempts, for the trainer dashboard's "who just
 * submitted" glance widget — not the full results log (see
 * `listAllAttempts`). */
export async function listRecentAttempts(
  limit = 6,
): Promise<AttemptListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select(ATTEMPT_COLUMNS)
    .neq("status", "in_progress")
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydrateAttempts(supabase, (data ?? []) as Record<string, unknown>[]);
}

export interface BreakdownQuestion {
  attemptQuestionId: string;
  type: QuestionType;
  text: string | null;
  points: number;
  sortOrder: number;
  explanation: string | null;
  sampleAnswer: string | null;
  gradingNotes: string | null;
  keywords: string | null;
  options: {
    id: string;
    text: string | null;
    isCorrect: boolean;
    selected: boolean;
  }[];
  essay: {
    answerId: string | null;
    text: string | null;
    manualScore: number | null;
    feedback: string | null;
  } | null;
  awardedObjective: number | null; // null for essay
}

export interface AttemptDetail {
  id: string;
  quizId: string;
  quizTitle: string;
  userName: string;
  isGuest: boolean;
  attemptNumber: number;
  status: string;
  autoScore: number | null;
  manualScore: number | null;
  finalScore: number | null;
  totalPoints: number | null;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  startedAt: string | null;
  scheduleStatus: ScheduleStatus;
  scheduleWindow: { startsAt: string | null; endsAt: string | null } | null;
  questions: BreakdownQuestion[];
}

/** Read-only full breakdown of one attempt (RLS gives admin/super_admin/spv
 * SELECT on all). */
export async function getAttemptDetail(
  attemptId: string,
): Promise<AttemptDetail | null> {
  const supabase = await createClient();

  const { data: a, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw error;
  if (!a) return null;

  const [{ data: quiz }, { data: profile }, { data: aqs }, { data: session }] =
    await Promise.all([
      supabase
        .from("quizzes")
        .select("title, start_at, end_at")
        .eq("id", a.quiz_id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, email, is_guest")
        .eq("user_id", a.user_id)
        .maybeSingle(),
      supabase
        .from("attempt_questions")
        .select("*")
        .eq("attempt_id", attemptId)
        .order("sort_order"),
      a.session_id
        ? supabase
            .from("assessment_sessions")
            .select("starts_at, expires_at")
            .eq("id", a.session_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const aqIds = (aqs ?? []).map((q) => q.id as string);
  const [{ data: opts }, { data: answers }, { data: answerOpts }] =
    await Promise.all([
      supabase
        .from("attempt_question_options")
        .select("*")
        .in("attempt_question_id", aqIds.length ? aqIds : ["_"]),
      supabase
        .from("attempt_answers")
        .select("*")
        .eq("attempt_id", attemptId),
      supabase
        .from("attempt_answer_options")
        .select("attempt_answer_id, attempt_question_option_id"),
    ]);

  const answerByAq = new Map(
    (answers ?? []).map((r) => [r.attempt_question_id as string, r]),
  );
  const selectedOptionIds = new Set(
    (answerOpts ?? [])
      .filter((ao) =>
        (answers ?? []).some((an) => an.id === ao.attempt_answer_id),
      )
      .map((ao) => ao.attempt_question_option_id as string),
  );

  const questions: BreakdownQuestion[] = (aqs ?? []).map((q) => {
    const qOpts = (opts ?? []).filter(
      (o) => o.attempt_question_id === q.id,
    );
    const isEssay = q.question_type === "essay";
    const nCorrect = qOpts.filter((o) => o.is_correct).length;
    const selCorrect = qOpts.filter(
      (o) => o.is_correct && selectedOptionIds.has(o.id),
    ).length;
    const selTotal = qOpts.filter((o) => selectedOptionIds.has(o.id)).length;
    const objectiveOk =
      !isEssay && nCorrect > 0 && selCorrect === nCorrect && selTotal === nCorrect;
    const ans = answerByAq.get(q.id);

    return {
      attemptQuestionId: q.id,
      type: q.question_type,
      text: q.question_text,
      points: Number(q.points),
      sortOrder: q.sort_order,
      explanation: q.explanation,
      sampleAnswer: q.sample_answer,
      gradingNotes: q.grading_notes,
      keywords: q.keywords,
      options: qOpts
        .sort((x, y) => x.sort_order - y.sort_order)
        .map((o) => ({
          id: o.id,
          text: o.answer_text,
          isCorrect: o.is_correct,
          selected: selectedOptionIds.has(o.id),
        })),
      essay: isEssay
        ? {
            answerId: (ans?.id as string) ?? null,
            text: (ans?.essay_answer as string) ?? null,
            manualScore: (ans?.manual_score as number | null) ?? null,
            feedback: (ans?.grader_feedback as string | null) ?? null,
          }
        : null,
      awardedObjective: isEssay ? null : objectiveOk ? Number(q.points) : 0,
    };
  });

  const scheduleWindow = a.session_id
    ? {
        startsAt: (session?.starts_at as string | null) ?? null,
        endsAt: (session?.expires_at as string | null) ?? null,
      }
    : {
        startsAt: (quiz?.start_at as string | null) ?? null,
        endsAt: (quiz?.end_at as string | null) ?? null,
      };

  return {
    id: a.id,
    quizId: a.quiz_id,
    quizTitle: (quiz?.title as string) ?? "Quiz",
    userName:
      (profile?.full_name as string) || (profile?.email as string) || "User",
    isGuest: (profile?.is_guest as boolean) ?? false,
    attemptNumber: a.attempt_number,
    status: a.status,
    autoScore: a.auto_score,
    manualScore: a.manual_score,
    finalScore: a.final_score,
    totalPoints: a.total_points,
    percentage: a.percentage,
    passed: a.passed,
    submittedAt: a.submitted_at,
    startedAt: a.started_at,
    scheduleStatus: evaluateAttemptSchedule({
      startedAt: a.started_at,
      session: a.session_id ? scheduleWindow : null,
      quiz: a.session_id ? null : scheduleWindow,
    }),
    scheduleWindow,
    questions,
  };
}
