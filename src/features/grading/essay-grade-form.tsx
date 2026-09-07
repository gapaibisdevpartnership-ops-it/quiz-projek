"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gradeEssay } from "@/features/grading/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";

export function EssayGradeForm({
  answerId,
  attemptId,
  maxPoints,
  currentScore,
  currentFeedback,
}: {
  answerId: string;
  attemptId: string;
  maxPoints: number;
  currentScore: number | null;
  currentFeedback: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [score, setScore] = useState(currentScore?.toString() ?? "");
  const [feedback, setFeedback] = useState(currentFeedback ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(currentScore != null);

  function submit() {
    setError(null);
    const n = Number(score);
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

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="flex items-end gap-2">
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
        <Button size="sm" disabled={pending} onClick={submit}>
          {pending ? "Saving…" : saved ? "Update grade" : "Save grade"}
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
