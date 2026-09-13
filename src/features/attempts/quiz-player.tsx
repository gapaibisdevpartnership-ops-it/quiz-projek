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
import type { PlayerData, PlayerQuestion } from "./types";
import {
  saveEssayAnswer,
  saveObjectiveAnswer,
  submitAttempt,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatCountdown, seededShuffle } from "./shuffle";

type SaveState = "idle" | "saving" | "saved" | "error";

export function QuizPlayer({ data }: { data: PlayerData }) {
  const router = useRouter();
  const { attempt, quiz } = data;
  const finalized = attempt.status !== "in_progress";

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

  // --- timer -------------------------------------------------------------
  const deadline = attempt.durationMinutes
    ? new Date(attempt.startedAt).getTime() + attempt.durationMinutes * 60_000
    : null;
  const [remaining, setRemaining] = useState<number | null>(null);

  const doSubmit = useCallback(
    async (auto: boolean) => {
      if (finalized || submitting) return;
      if (!auto && !window.confirm("Submit this attempt? You cannot change your answers afterward."))
        return;
      setSubmitting(true);
      const res = await submitAttempt(attempt.id, quiz.id);
      if (!res.ok) {
        setBanner(res.error);
        setSubmitting(false);
        return;
      }
      router.replace(`/quizzes/${quiz.id}/result/${attempt.id}`);
      router.refresh();
    },
    [attempt.id, quiz.id, finalized, submitting, router],
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
    if (finalized) return;
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
    if (finalized) return;
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
        <div>
          <h1 className="font-semibold">{quiz.title}</h1>
          <p className="text-muted-foreground text-sm">
            Question {current + 1} of {questions.length} · {answeredCount}{" "}
            answered
          </p>
        </div>
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
      </header>

      {finalized ? (
        <Alert>
          This attempt is {attempt.status.replace("_", " ")}.{" "}
          <a
            className="underline"
            href={`/quizzes/${quiz.id}/result/${attempt.id}`}
          >
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
          return (
            <button
              key={x.id}
              onClick={() => setCurrent(i)}
              className={cn(
                "h-8 w-8 rounded border text-xs",
                i === current && "ring-2 ring-ring",
                done ? "bg-primary text-primary-foreground" : "bg-background",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="text-muted-foreground text-xs">
          {q.points} pt · {q.type.replace("_", " ")}
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
            disabled={finalized}
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
                      disabled={finalized}
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
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
        >
          Previous
        </Button>
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)}>Next</Button>
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

