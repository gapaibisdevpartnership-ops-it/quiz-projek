"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
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
    strictTimingEnabled: quiz?.strictTimingEnabled ?? false,
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
      strictTimingEnabled: f.strictTimingEnabled,
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
      toast.success(quiz ? "Quiz settings saved" : "Quiz created");
      router.push(
        quiz ? `/admin/quizzes/${quiz.id}` : `/admin/quizzes/${res.id}/questions`,
      );
      router.refresh();
    });
  }

  const toggle = (
    k:
      | "shuffleQuestions"
      | "shuffleAnswers"
      | "showResult"
      | "showCorrectAnswer"
      | "strictTimingEnabled",
    label: string,
    hint: string,
  ) => (
    <label className="flex items-start gap-3 text-sm">
      <Checkbox
        className="mt-0.5"
        checked={f[k]}
        onCheckedChange={(checked) => set(k, checked === true)}
      />
      <span>
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground block text-xs">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {quiz ? "Quiz settings" : "New quiz"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {quiz
              ? "Update the content and rules for this quiz."
              : "Set up the content and rules — you'll add questions next."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={() =>
              router.push(quiz ? `/admin/quizzes/${quiz.id}` : "/admin/quizzes")
            }
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : quiz ? "Save changes" : "Create quiz"}
          </Button>
        </div>
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g. Marketing Fundamentals"
                value={f.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                placeholder="A one- or two-sentence summary shown on the quiz list."
                value={f.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instr">Instructions</Label>
              <Textarea
                id="instr"
                placeholder="Shown to the trainee before they start — e.g. what to expect, how it's graded."
                value={f.instructions}
                onChange={(e) => set("instructions", e.target.value)}
              />
            </div>
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
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scoring &amp; attempts</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 grid-cols-2">
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
              <div className="col-span-2 space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  placeholder="Untimed"
                  value={f.durationMinutes}
                  onChange={(e) => set("durationMinutes", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Behaviour</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {toggle(
                "shuffleQuestions",
                "Shuffle question order",
                "Each attempt gets a different question order.",
              )}
              {toggle(
                "shuffleAnswers",
                "Shuffle answer options",
                "Answer choices are reordered per attempt.",
              )}
              {toggle(
                "showResult",
                "Show result to the sales user",
                "They see their score right after submitting.",
              )}
              {toggle(
                "showCorrectAnswer",
                "Reveal correct answers",
                "Shown alongside their own answers on the result.",
              )}
              {toggle(
                "strictTimingEnabled",
                "Realistic timed mode",
                "Lock each answer once the candidate moves on or its own time limit (set per question) runs out — no going back to edit.",
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Availability window</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <p className="text-muted-foreground text-xs">
                Leave both blank to keep the quiz open indefinitely.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
