"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, Quiz } from "@/types/domain";
import {
  quizSettingsSchema,
  type QuizSettingsInput,
} from "@/lib/validation/quiz";
import { createQuiz, updateQuiz } from "@/features/quizzes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const toLocalInput = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : "";
const toIso = (local: string) =>
  local ? new Date(local).toISOString() : null;

export function QuizSettingsForm({
  categories,
  quiz,
}: {
  categories: Category[];
  quiz?: Quiz;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState({
    title: quiz?.title ?? "",
    description: quiz?.description ?? "",
    instructions: quiz?.instructions ?? "",
    categoryId: quiz?.categoryId ?? "",
    durationMinutes: quiz?.durationMinutes?.toString() ?? "",
    passingScore: quiz?.passingScore?.toString() ?? "70",
    maxAttempts: quiz?.maxAttempts?.toString() ?? "1",
    shuffleQuestions: quiz?.shuffleQuestions ?? false,
    shuffleAnswers: quiz?.shuffleAnswers ?? false,
    showResult: quiz?.showResult ?? true,
    showCorrectAnswer: quiz?.showCorrectAnswer ?? false,
    startAt: toLocalInput(quiz?.startAt ?? null),
    endAt: toLocalInput(quiz?.endAt ?? null),
  });

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setError(null);
    const input: QuizSettingsInput = {
      title: f.title,
      description: f.description,
      instructions: f.instructions,
      categoryId: f.categoryId || null,
      durationMinutes: f.durationMinutes ? Number(f.durationMinutes) : null,
      passingScore: Number(f.passingScore),
      maxAttempts: Number(f.maxAttempts),
      shuffleQuestions: f.shuffleQuestions,
      shuffleAnswers: f.shuffleAnswers,
      showResult: f.showResult,
      showCorrectAnswer: f.showCorrectAnswer,
      startAt: toIso(f.startAt),
      endAt: toIso(f.endAt),
    };
    const parsed = quizSettingsSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }
    start(async () => {
      const res = quiz
        ? await updateQuiz(quiz.id, parsed.data)
        : await createQuiz(parsed.data);
      if (!res.ok) return setError(res.error);
      router.push(
        quiz ? `/admin/quizzes/${quiz.id}` : `/admin/quizzes/${res.id}/questions`,
      );
      router.refresh();
    });
  }

  const checkbox = (
    k: "shuffleQuestions" | "shuffleAnswers" | "showResult" | "showCorrectAnswer",
    label: string,
  ) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={f[k]}
        onChange={(e) => set(k, e.target.checked)}
      />
      {label}
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {quiz ? "Quiz settings" : "New quiz"}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              router.push(quiz ? `/admin/quizzes/${quiz.id}` : "/admin/quizzes")
            }
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={f.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes, optional)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={f.durationMinutes}
                onChange={(e) => set("durationMinutes", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instr">Instructions</Label>
            <Textarea
              id="instr"
              value={f.instructions}
              onChange={(e) => set("instructions", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scoring &amp; attempts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pass">Passing score (%)</Label>
            <Input
              id="pass"
              type="number"
              min={0}
              max={100}
              value={f.passingScore}
              onChange={(e) => set("passingScore", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max">Max attempts</Label>
            <Input
              id="max"
              type="number"
              min={1}
              value={f.maxAttempts}
              onChange={(e) => set("maxAttempts", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Behaviour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checkbox("shuffleQuestions", "Shuffle question order")}
          {checkbox("shuffleAnswers", "Shuffle answer options")}
          {checkbox("showResult", "Show result to the sales user")}
          {checkbox("showCorrectAnswer", "Reveal correct answers on the result")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Availability window (optional)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="start">Opens</Label>
            <Input
              id="start"
              type="datetime-local"
              value={f.startAt}
              onChange={(e) => set("startAt", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end">Closes</Label>
            <Input
              id="end"
              type="datetime-local"
              value={f.endAt}
              onChange={(e) => set("endAt", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
