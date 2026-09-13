"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { duplicateQuestion } from "@/features/questions/actions";

/**
 * Edit + Duplicate actions for one row in the Question Bank list
 * (docs/DUPLICATE_QUESTION_PLAN.md). A small client island so a failed
 * duplicate shows an error instead of silently doing nothing, and a
 * double-click can't fire the action twice.
 */
export function QuestionRowActions({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDuplicate() {
    setError(null);
    start(async () => {
      const res = await duplicateQuestion(questionId);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <Link
          className="text-sm underline"
          href={`/admin/questions/${questionId}/edit`}
        >
          Edit
        </Link>
        <button
          type="button"
          className="text-sm underline disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          onClick={handleDuplicate}
        >
          {pending ? "Duplicating…" : "Duplicate"}
        </button>
      </div>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
