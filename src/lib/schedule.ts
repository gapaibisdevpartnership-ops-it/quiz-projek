/** Was an attempt taken inside its intended time window?
 *
 * Prefers the session link's own window (`session`), since guest attempts
 * are always tied to one; falls back to the parent quiz's account-based
 * assignment window (`quiz`) when there's no session (or it was deleted —
 * `quiz_attempts.session_id` is `on delete set null`). An always-open
 * link/quiz (no bounds set anywhere) has nothing invalid to flag.
 */

export type ScheduleStatus = "within" | "outside" | "unknown";

interface ScheduleWindow {
  startsAt: string | null;
  endsAt: string | null;
}

export function evaluateAttemptSchedule({
  startedAt,
  session,
  quiz,
}: {
  startedAt: string | null;
  session: ScheduleWindow | null;
  quiz: ScheduleWindow | null;
}): ScheduleStatus {
  if (!startedAt) return "unknown";

  const window = session ?? quiz;
  if (!window || (!window.startsAt && !window.endsAt)) return "unknown";

  const started = new Date(startedAt).getTime();
  if (window.startsAt && started < new Date(window.startsAt).getTime()) {
    return "outside";
  }
  if (window.endsAt && started > new Date(window.endsAt).getTime()) {
    return "outside";
  }
  return "within";
}
