"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  deleteQuestionPermanently,
  duplicateQuestion,
} from "@/features/questions/actions";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Edit + Duplicate actions for one row in the Question Bank list
 * (docs/DUPLICATE_QUESTION_PLAN.md). A small client island so a failed
 * duplicate shows an error instead of silently doing nothing, and a
 * double-click can't fire the action twice.
 *
 * Built on the shared Button/buttonVariants (not hand-rolled Tailwind) so
 * focus ring, disabled state, and hit-area match the rest of the app. This
 * project's `Button` doesn't support `asChild` (no Radix Slot), so Edit — a
 * `<Link>` that must look like a button — uses `buttonVariants()` as a
 * className directly, same pattern as "+ New question" on this page.
 */
export function QuestionRowActions({
  questionId,
  questionText,
  viewerIsSuperAdmin,
}: {
  questionId: string;
  questionText: string | null;
  viewerIsSuperAdmin: boolean;
}) {
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

  function handleDelete() {
    const label = questionText || "this question";
    if (!window.confirm(`Delete "${label}" permanently? This cannot be undone.`))
      return;
    setError(null);
    start(async () => {
      const res = await deleteQuestionPermanently(questionId);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <Link
          href={`/admin/questions/${questionId}/edit`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={handleDuplicate}
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {pending ? "Duplicating…" : "Duplicate"}
        </Button>
        {viewerIsSuperAdmin ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={pending}
            onClick={handleDelete}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
