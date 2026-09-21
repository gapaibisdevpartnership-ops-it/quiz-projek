"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock } from "lucide-react";
import type { PlayerData, PlayerQuestion } from "./types";
import {
  lockAttemptQuestion,
  markQuestionViewed,
  saveEssayAnswer,
  saveObjectiveAnswer,
  submitAttempt,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  clockOffsetMs,
  formatCountdown,
  questionRemainingMs,
  seededShuffle,
} from "./shuffle";

type SaveState = "idle" | "saving" | "saved" | "error";

export function QuizPlayer({
  data,
  resultBasePath,
}: {
  data: PlayerData;
  /**
   * Base path this player links to for "view result" (post-submit redirect
   * + the finalized banner link) — the final link is
   * `${resultBasePath}/result/${attempt.id}`. Defaults to the account-based
   * flow's `/quizzes/[quizId]`. The guest flow
   * (docs/PUBLIC_SESSION_LINK_PLAN.md) passes `/assessment/[token]` so
   * guests land on their own result view instead of the account-based one
   * under `(app)`.
   */
  resultBasePath?: string;
}) {
  const router = useRouter();
  const { attempt, quiz } = data;
  const finalized = attempt.status !== "in_progress";
  const strict = quiz.strictTimingEnabled;
  const resultHref = `${resultBasePath ?? `/quizzes/${quiz.id}`}/result/${attempt.id}`;

  const questions = useMemo(() => {
    const base = [...data.questions].sort((a, b) => a.sortOrder - b.sortOrder);
    const qs = attempt.shuffleQuestions
      ? seededShuffle(base, attempt.id)
      : base;
    if (!attempt.shuffleAnswers) return qs;
    return qs.map((q) => ({
      ...q,
      options: seededShuffle(q.options, attempt.id + q.id),
    }));
  }, [data.questions, attempt.id, attempt.shuffleQuestions, attempt.shuffleAnswers]);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<
    Record<string, { essay: string; selected: string[] }>
  >(() =>
    Object.fromEntries(
      data.questions.map((q) => [
        q.id,
        {
          essay: q.answer?.essay ?? "",
          selected: q.answer?.selectedOptionIds ?? [],
        },
      ]),
    ),
  );
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // --- realistic timed mode: per-question view/lock ---------------------
  const [lockedIds, setLockedIds] = useState<Set<string>>(
    () => new Set(data.questions.filter((x) => x.lockedAt).map((x) => x.id)),
  );
  const [viewedAtById, setViewedAtById] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        data.questions
          .filter((x) => x.viewedAt)
          .map((x) => [x.id, x.viewedAt as string]),
      ),
  );
  const isLocked = useCallback((id: string) => lockedIds.has(id), [lockedIds]);

  const lockQuestion = useCallback(
    async (target: PlayerQuestion) => {
      if (!strict || isLocked(target.id)) return;
      setLockedIds((s) => new Set(s).add(target.id));
      const res = await lockAttemptQuestion(target.id);
      if (!res.ok) setBanner(res.error);
    },
    [strict, isLocked],
  );

  // --- timer -------------------------------------------------------------
  const deadline = attempt.durationMinutes
    ? new Date(attempt.startedAt).getTime() + attempt.durationMinutes * 60_000
    : null;
  const [remaining, setRemaining] = useState<number | null>(null);

  // Client/server clock skew, captured once when the page loads (lazy
  // initial state, not useMemo — Date.now() is impure and must not run
  // during render) — NOT recomputed every time the current question
  // changes, or it would pick up however much real time has passed since
  // load as if it were clock skew, silently inflating every later
  // question's remaining time.
  const [clockOffset] = useState(() =>
    clockOffsetMs(attempt.serverNow, Date.now()),
  );

  const doSubmit = useCallback(
    async (auto: boolean) => {
      if (finalized || submitting) return;
      if (!auto && !window.confirm("Submit this attempt? You cannot change your answers afterward."))
        return;
      setSubmitting(true);
      const currentQuestion = questions[current];
      if (currentQuestion) await lockQuestion(currentQuestion);
      const res = await submitAttempt(attempt.id, quiz.id);
      if (!res.ok) {
        setBanner(res.error);
        setSubmitting(false);
        return;
      }
      router.replace(resultHref);
      router.refresh();
    },
    [
      attempt.id,
      quiz.id,
      finalized,
      submitting,
      router,
      resultHref,
      questions,
      current,
      lockQuestion,
    ],
  );

  useEffect(() => {
    if (deadline == null || finalized) return;
    // Correct the browser clock against the server's `now` at load.
    const offset = Date.now() - new Date(attempt.serverNow).getTime();
    const tick = () => {
      const left = deadline - (Date.now() - offset);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(t);
        void doSubmit(true);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline, finalized, doSubmit, attempt.serverNow]);

  // Navigate to a question, locking whichever one is being left behind
  // (only takes effect in strict mode — a no-op lock otherwise).
  const goTo = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(questions.length - 1, nextIndex));
      // Only lock the question being left when moving forward past it
      // (Next, or jumping ahead) — stepping back to glance at an earlier
      // question must not lock the one you're still actively working on;
      // its own timeout (if any) is what locks it, not a backward glance.
      if (clamped > current) {
        const leaving = questions[current];
        if (leaving) void lockQuestion(leaving);
      }
      setCurrent(clamped);
    },
    [current, questions, lockQuestion],
  );

  // Stamp when the candidate first reaches a question, so its personal
  // countdown (below) has a stable, reload-safe anchor.
  useEffect(() => {
    if (!strict || finalized) return;
    const q = questions[current];
    if (!q || viewedAtById[q.id] || isLocked(q.id)) return;
    let cancelled = false;
    void markQuestionViewed(q.id).then((res) => {
      if (cancelled || !res.ok) return;
      setViewedAtById((s) => ({ ...s, [q.id]: res.viewedAt }));
    });
    return () => {
      cancelled = true;
    };
  }, [strict, finalized, current, questions, viewedAtById, isLocked]);

  // Per-question countdown — only ticks for the current question, since a
  // question locks (and stops mattering) the moment it's left.
  const [qRemaining, setQRemaining] = useState<number | null>(null);
  useEffect(() => {
    const q = strict && !finalized ? questions[current] : undefined;
    const viewedAt = q ? viewedAtById[q.id] : undefined;
    const active = !!(q && !isLocked(q.id) && q.timeLimitSeconds && viewedAt);

    // Returns false once the deadline has passed, so the caller knows not
    // to (re)arm/keep the interval — expiry is handled once, here, not by
    // this function reaching into the interval id itself (which would be
    // unassigned yet on this very first, synchronous call).
    const tick = (): boolean => {
      if (!active || !q || !viewedAt || !q.timeLimitSeconds) {
        setQRemaining(null);
        return false;
      }
      const left = questionRemainingMs({
        viewedAt,
        timeLimitSeconds: q.timeLimitSeconds,
        offsetMs: clockOffset,
        clientNow: Date.now(),
      });
      setQRemaining(left);
      if (left <= 0) {
        const isLastQuestion = current === questions.length - 1;
        if (isLastQuestion) {
          void lockQuestion(q).then(() => doSubmit(true));
        } else {
          goTo(current + 1);
        }
        return false;
      }
      return true;
    };
    if (!tick()) return;
    const t = setInterval(() => {
      if (!tick()) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [
    strict,
    finalized,
    current,
    questions,
    viewedAtById,
    isLocked,
    lockQuestion,
    goTo,
    doSubmit,
    clockOffset,
  ]);

  // --- saving ----------------------------------------------------------
  const essayTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function markSaved(id: string, ok: boolean) {
    setSaveState((s) => ({ ...s, [id]: ok ? "saved" : "error" }));
  }

  async function persistObjective(q: PlayerQuestion, selected: string[]) {
    setSaveState((s) => ({ ...s, [q.id]: "saving" }));
    const res = await saveObjectiveAnswer(q.id, selected);
    markSaved(q.id, res.ok);
    if (!res.ok) setBanner(res.error);
  }

  function onToggleOption(q: PlayerQuestion, optionId: string) {
    if (finalized || isLocked(q.id)) return;
    let next: string[] = [];
    // flushSync forces the updater below to run synchronously, so `next` is
    // guaranteed set (from the freshest `prev`) before persistObjective is
    // called immediately after — without it, setAnswers's updater can run
    // asynchronously and `next` would still be `[]` when read below.
    flushSync(() => {
      setAnswers((prev) => {
        const cur = prev[q.id].selected;
        next =
          q.type === "multiple_choice"
            ? cur.includes(optionId)
              ? cur.filter((x) => x !== optionId)
              : [...cur, optionId]
            : [optionId];
        return { ...prev, [q.id]: { ...prev[q.id], selected: next } };
      });
    });
    void persistObjective(q, next);
  }

  function onEssayChange(q: PlayerQuestion, value: string) {
    if (finalized || isLocked(q.id)) return;
    setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], essay: value } }));
    setSaveState((s) => ({ ...s, [q.id]: "saving" }));
    clearTimeout(essayTimers.current[q.id]);
    essayTimers.current[q.id] = setTimeout(async () => {
      const res = await saveEssayAnswer(q.id, value);
      markSaved(q.id, res.ok);
      if (!res.ok) setBanner(res.error);
    }, 800);
  }

  const q = questions[current];
  const answeredCount = questions.filter((x) => {
    const a = answers[x.id];
    return x.type === "essay" ? a.essay.trim().length > 0 : a.selected.length > 0;
  }).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="min-w-48 flex-1 space-y-1">
          <h1 className="font-semibold">{quiz.title}</h1>
          <p className="text-muted-foreground text-sm">
            Question {current + 1} of {questions.length} · {answeredCount}{" "}
            answered
          </p>
          <Progress
            value={(answeredCount / questions.length) * 100}
            className="h-1.5"
          />
        </div>
        <div className="flex items-center gap-2">
          {qRemaining != null ? (
            <span
              className={cn(
                "rounded-md border px-3 py-1 text-sm font-medium tabular-nums",
                qRemaining < 10_000 && "border-destructive text-destructive",
              )}
              title="Time left for this question"
            >
              {formatCountdown(qRemaining)}
            </span>
          ) : null}
          {remaining != null ? (
            <span
              className={cn(
                "rounded-md border px-3 py-1 text-sm font-medium tabular-nums",
                remaining < 60_000 && "border-destructive text-destructive",
              )}
            >
              {formatCountdown(remaining)}
            </span>
          ) : null}
        </div>
      </header>

      {finalized ? (
        <Alert>
          This attempt is {attempt.status.replace("_", " ")}.{" "}
          <a className="underline" href={resultHref}>
            View result
          </a>
        </Alert>
      ) : null}
      {banner ? <Alert variant="destructive">{banner}</Alert> : null}

      <div className="flex flex-wrap gap-1">
        {questions.map((x, i) => {
          const a = answers[x.id];
          const done =
            x.type === "essay"
              ? a.essay.trim().length > 0
              : a.selected.length > 0;
          const locked = isLocked(x.id);
          return (
            <button
              key={x.id}
              onClick={() => goTo(i)}
              aria-label={`Question ${i + 1}${done ? ", answered" : ", not answered"}${locked ? ", locked" : ""}${i === current ? ", current" : ""}`}
              aria-current={i === current ? "step" : undefined}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded border text-xs",
                i === current && "ring-2 ring-ring",
                done ? "bg-primary text-primary-foreground" : "bg-background",
                locked && "opacity-60",
              )}
            >
              {locked ? (
                <Lock className="size-3.5" aria-hidden="true" />
              ) : (
                i + 1
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span>
            {q.points} pt · {q.type.replace("_", " ")}
          </span>
          {isLocked(q.id) ? (
            <span className="inline-flex items-center gap-1 text-foreground">
              <Lock className="size-3" aria-hidden="true" /> Locked
            </span>
          ) : null}
        </div>
        {q.text ? <p className="font-medium">{q.text}</p> : null}
        {q.imageUrl ? (
          <Image
            src={q.imageUrl}
            alt=""
            width={480}
            height={320}
            className="rounded-md border object-contain"
            unoptimized
          />
        ) : null}

        {q.type === "essay" ? (
          <Textarea
            className="min-h-40"
            placeholder="Type your answer…"
            value={answers[q.id].essay}
            disabled={finalized || isLocked(q.id)}
            onChange={(e) => onEssayChange(q, e.target.value)}
          />
        ) : (
          <ul className="space-y-2">
            {q.options.map((o) => {
              const checked = answers[q.id].selected.includes(o.id);
              return (
                <li key={o.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm",
                      checked && "border-primary bg-primary/5",
                    )}
                  >
                    <input
                      type={q.type === "multiple_choice" ? "checkbox" : "radio"}
                      name={q.id}
                      checked={checked}
                      disabled={finalized || isLocked(q.id)}
                      onChange={() => onToggleOption(q, o.id)}
                    />
                    {o.imageUrl ? (
                      <Image
                        src={o.imageUrl}
                        alt=""
                        width={90}
                        height={68}
                        className="rounded border object-cover"
                        unoptimized
                      />
                    ) : null}
                    {o.text ? <span>{o.text}</span> : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-muted-foreground text-xs">
          {saveState[q.id] === "saving"
            ? "Saving…"
            : saveState[q.id] === "saved"
              ? "Saved"
              : saveState[q.id] === "error"
                ? "Save failed — change your answer to retry"
                : " "}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={current === 0}
          onClick={() => goTo(current - 1)}
        >
          Previous
        </Button>
        {current < questions.length - 1 ? (
          <Button onClick={() => goTo(current + 1)}>Next</Button>
        ) : (
          <Button
            disabled={finalized || submitting}
            onClick={() => doSubmit(false)}
          >
            {submitting ? "Submitting…" : "Submit attempt"}
          </Button>
        )}
      </div>
    </div>
  );
}

