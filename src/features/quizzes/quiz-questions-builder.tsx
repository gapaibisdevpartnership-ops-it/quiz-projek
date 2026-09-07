"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Question, QuizQuestionWithQuestion } from "@/types/domain";
import { QUESTION_TYPE_LABELS } from "@/lib/validation/question";
import {
  addQuestionToQuiz,
  removeQuizQuestion,
  reorderQuizQuestions,
  setQuizQuestionPoints,
} from "@/features/quizzes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function QuizQuestionsBuilder({
  quizId,
  attached,
  available,
}: {
  quizId: string;
  attached: QuizQuestionWithQuestion[];
  available: Question[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const refresh = () => router.refresh();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Action failed.");
      else refresh();
    });

  function move(index: number, dir: -1 | 1) {
    const next = [...attached];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() =>
      reorderQuizQuestions(
        quizId,
        next.map((a) => a.id),
      ),
    );
  }

  const total = attached.reduce((s, a) => s + a.points, 0);

  return (
    <div className="space-y-6">
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>
            Questions in this quiz ({attached.length}) · {total} pt total
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attached.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No questions yet. Add some from the bank below.
            </p>
          ) : (
            <ul className="space-y-2">
              {attached.map((a, i) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border p-3"
                >
                  <div className="flex flex-col">
                    <button
                      className="text-xs disabled:opacity-30"
                      disabled={pending || i === 0}
                      onClick={() => move(i, -1)}
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      className="text-xs disabled:opacity-30"
                      disabled={pending || i === attached.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {i + 1}. {a.question.questionText || "(image-only)"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {QUESTION_TYPE_LABELS[a.question.questionType]}
                    </p>
                  </div>
                  <label className="flex items-center gap-1 text-xs">
                    Points
                    <Input
                      type="number"
                      min={1}
                      defaultValue={a.points}
                      className="h-8 w-20"
                      disabled={pending}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0 && v !== a.points)
                          run(() => setQuizQuestionPoints(quizId, a.id, v));
                      }}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => removeQuizQuestion(quizId, a.id))}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add from the question bank</CardTitle>
        </CardHeader>
        <CardContent>
          {available.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Every active question is already in this quiz.{" "}
              <Link className="underline" href="/admin/questions/new">
                Create a new one
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y">
              {available.map((q) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {q.questionText || "(image-only)"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {QUESTION_TYPE_LABELS[q.questionType]}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => addQuestionToQuiz(quizId, q.id))}
                  >
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
