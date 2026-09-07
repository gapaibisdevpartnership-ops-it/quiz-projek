"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { QUESTION_TYPES, type QuestionType } from "@/lib/constants";
import {
  QUESTION_TYPE_LABELS,
  questionSchema,
  type QuestionInput,
} from "@/lib/validation/question";
import type { Category, QuestionWithOptions } from "@/types/domain";
import { createQuestion, updateQuestion } from "@/features/questions/actions";
import { uploadAsset, type AssetFolder } from "@/features/questions/upload-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface OptionDraft {
  id?: string;
  answerText: string;
  imageUrl: string | null;
  isCorrect: boolean;
}

interface Props {
  categories: Category[];
  scopeId: string;
  question?: QuestionWithOptions;
}

const emptyOption = (): OptionDraft => ({
  answerText: "",
  imageUrl: null,
  isCorrect: false,
});

const trueFalseOptions = (): OptionDraft[] => [
  { answerText: "True", imageUrl: null, isCorrect: true },
  { answerText: "False", imageUrl: null, isCorrect: false },
];

function ImageField({
  folder,
  scopeId,
  value,
  onChange,
}: {
  folder: AssetFolder;
  scopeId: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setErr(null);
            try {
              onChange(await uploadAsset(folder, scopeId, file));
            } catch (e2) {
              setErr(e2 instanceof Error ? e2.message : "Upload failed.");
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {err ? <Alert variant="destructive">{err}</Alert> : null}
      {value ? (
        <Image
          src={value}
          alt=""
          width={160}
          height={120}
          className="rounded-md border object-cover"
          unoptimized
        />
      ) : null}
    </div>
  );
}

export function QuestionEditor({ categories, scopeId, question }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<QuestionType>(
    question?.questionType ?? "single_choice",
  );
  const [categoryId, setCategoryId] = useState(question?.categoryId ?? "");
  const [text, setText] = useState(question?.questionText ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    question?.questionImageUrl ?? null,
  );
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [sampleAnswer, setSampleAnswer] = useState(
    question?.sampleAnswer ?? "",
  );
  const [gradingNotes, setGradingNotes] = useState(
    question?.gradingNotes ?? "",
  );
  const [options, setOptions] = useState<OptionDraft[]>(() => {
    if (question && question.questionType !== "essay") {
      return question.options.map((o) => ({
        id: o.id,
        answerText: o.answerText ?? "",
        imageUrl: o.imageUrl,
        isCorrect: o.isCorrect,
      }));
    }
    if (question?.questionType === "essay") return [];
    return [emptyOption(), emptyOption()];
  });

  const isChoice = type === "single_choice" || type === "multiple_choice";
  const isEssay = type === "essay";

  function changeType(next: QuestionType) {
    setType(next);
    setError(null);
    if (next === "true_false") setOptions(trueFalseOptions());
    else if (next === "essay") setOptions([]);
    else if (options.length < 2) setOptions([emptyOption(), emptyOption()]);
  }

  function setCorrect(index: number, checked: boolean) {
    setOptions((prev) =>
      prev.map((o, i) => {
        if (type === "single_choice" || type === "true_false") {
          return { ...o, isCorrect: i === index ? checked : false };
        }
        return i === index ? { ...o, isCorrect: checked } : o;
      }),
    );
  }

  const payload = useMemo((): QuestionInput => {
    const base = {
      categoryId: categoryId || null,
      questionText: text,
      questionImageUrl: imageUrl,
      difficulty: (difficulty || null) as QuestionInput["difficulty"],
      explanation,
    };
    if (type === "essay") {
      return { ...base, questionType: "essay", sampleAnswer, gradingNotes };
    }
    return {
      ...base,
      questionType: type,
      options: options.map((o) => ({
        id: o.id,
        answerText: o.answerText,
        imageUrl: o.imageUrl,
        isCorrect: o.isCorrect,
      })),
    } as QuestionInput;
  }, [
    categoryId,
    text,
    imageUrl,
    difficulty,
    explanation,
    type,
    sampleAnswer,
    gradingNotes,
    options,
  ]);

  function submit() {
    setError(null);
    const parsed = questionSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }
    startTransition(async () => {
      const res = question
        ? await updateQuestion(question.id, parsed.data)
        : await createQuestion(parsed.data);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/questions");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {question ? "Edit question" : "New question"}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/admin/questions")}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save question"}
          </Button>
        </div>
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={type}
                onChange={(e) => changeType(e.target.value as QuestionType)}
                disabled={!!question}
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
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
              <Label>Difficulty</Label>
              <Select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="">Unset</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qtext">Question text</Label>
            <Textarea
              id="qtext"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Provide question text or an image."
            />
          </div>

          <div className="space-y-2">
            <Label>Question image</Label>
            <ImageField
              folder="questions"
              scopeId={scopeId}
              value={imageUrl}
              onChange={setImageUrl}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expl">Explanation (shown after grading)</Label>
            <Textarea
              id="expl"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {isEssay ? (
        <Card>
          <CardHeader>
            <CardTitle>Grading (visible to trainers only)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sample">Sample answer</Label>
              <Textarea
                id="sample"
                value={sampleAnswer}
                onChange={(e) => setSampleAnswer(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gnotes">Grading notes</Label>
              <Textarea
                id="gnotes"
                value={gradingNotes}
                onChange={(e) => setGradingNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Answer options
              {type === "multiple_choice"
                ? " — mark all correct answers"
                : " — mark the one correct answer"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {options.map((o, i) => (
              <div
                key={i}
                className="flex flex-wrap items-start gap-3 rounded-md border p-3"
              >
                <label className="flex items-center gap-2 pt-2 text-sm">
                  <input
                    type={
                      type === "multiple_choice" ? "checkbox" : "radio"
                    }
                    name="correct"
                    checked={o.isCorrect}
                    onChange={(e) => setCorrect(i, e.target.checked)}
                  />
                  Correct
                </label>
                <div className="flex-1 space-y-2">
                  <Input
                    value={o.answerText}
                    placeholder={`Option ${i + 1} text`}
                    disabled={type === "true_false"}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((p, pi) =>
                          pi === i
                            ? { ...p, answerText: e.target.value }
                            : p,
                        ),
                      )
                    }
                  />
                  {type !== "true_false" ? (
                    <ImageField
                      folder="question-options"
                      scopeId={scopeId}
                      value={o.imageUrl}
                      onChange={(url) =>
                        setOptions((prev) =>
                          prev.map((p, pi) =>
                            pi === i ? { ...p, imageUrl: url } : p,
                          ),
                        )
                      }
                    />
                  ) : null}
                </div>
                {type !== "true_false" && options.length > 2 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setOptions((prev) => prev.filter((_, pi) => pi !== i))
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
            {type !== "true_false" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions((prev) => [...prev, emptyOption()])
                }
              >
                + Add option
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
      {isChoice ? null : null}
    </div>
  );
}
