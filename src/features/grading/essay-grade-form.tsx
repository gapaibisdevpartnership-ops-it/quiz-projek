"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gradeEssay } from "@/features/grading/actions";
import { matchKeywords } from "@/features/grading/keyword-match";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";

const BADGE_STYLES: Record<string, string> = {
  likely_correct: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  likely_incorrect: "bg-rose-100 text-rose-800",
};

const BADGE_LABELS: Record<string, string> = {
  likely_correct: "Likely Correct",
  partial: "Partial match",
  likely_incorrect: "Likely Incorrect",
};

export function EssayGradeForm({
  answerId,
  attemptId,
  maxPoints,
  currentScore,
  currentFeedback,
  keywords,
  answerText,
}: {
  answerId: string;
  attemptId: string;
  maxPoints: number;
  currentScore: number | null;
  currentFeedback: string | null;
  keywords?: string | null;
  answerText?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [score, setScore] = useState(currentScore?.toString() ?? "");
  const [feedback, setFeedback] = useState(currentFeedback ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(currentScore != null);

  const suggestion = matchKeywords(keywords ?? null, answerText ?? null);

  function submit(scoreOverride?: number) {
    setError(null);
    const n = scoreOverride ?? Number(score);
    if (!Number.isFinite(n) || n < 0 || n > maxPoints) {
      setError(`Score must be between 0 and ${maxPoints}.`);
      return;
    }
    start(async () => {
      const res = await gradeEssay(answerId, n, feedback, attemptId);
      if (!res.ok) return setError(res.error);
      setSaved(true);
      router.refresh();
    });
  }

  function markCorrect() {
    setScore(String(maxPoints));
    submit(maxPoints);
  }

  function markWrong() {
    setScore("0");
    submit(0);
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      {suggestion ? (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[suggestion.label]}`}
        >
          {BADGE_LABELS[suggestion.label]} ({suggestion.matched}/
          {suggestion.total} keywords) — suggestion only
        </span>
      ) : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          Score (0–{maxPoints})
          <Input
            type="number"
            min={0}
            max={maxPoints}
            step="0.5"
            value={score}
            className="mt-1 h-9 w-24"
            onChange={(e) => setScore(e.target.value)}
          />
        </label>
        <Button size="sm" disabled={pending} onClick={() => submit()}>
          {pending ? "Saving…" : saved ? "Update grade" : "Save grade"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={markCorrect}
        >
          Mark Correct
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={markWrong}
        >
          Mark Wrong
        </Button>
        {saved ? (
          <span className="text-xs text-emerald-600">Graded</span>
        ) : null}
      </div>
      <Textarea
        placeholder="Feedback for the trainee (optional)"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
    </div>
  );
}
