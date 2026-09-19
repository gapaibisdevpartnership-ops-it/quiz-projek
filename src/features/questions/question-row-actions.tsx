"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  deleteQuestionPermanently,
  duplicateQuestion,
} from "@/features/questions/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Edit + Duplicate + Delete actions for one row in the Question Bank list
 * (docs/DUPLICATE_QUESTION_PLAN.md). A small client island so a failed
 * duplicate shows an error instead of silently doing nothing, and a
 * double-click can't fire the action twice.
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

  function handleDuplicate() {
    start(async () => {
      const res = await duplicateQuestion(questionId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Question duplicated");
      router.refresh();
    });
  }

  function handleDelete() {
    const label = questionText || "this question";
    if (!window.confirm(`Delete "${label}" permanently? This cannot be undone.`))
      return;
    start(async () => {
      const res = await deleteQuestionPermanently(questionId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`"${label}" deleted`);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={pending}
          aria-label={`Actions for ${questionText || "this question"}`}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/admin/questions/${questionId}/edit`}>
            <Pencil aria-hidden="true" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDuplicate}>
          <Copy aria-hidden="true" />
          Duplicate
        </DropdownMenuItem>
        {viewerIsSuperAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
