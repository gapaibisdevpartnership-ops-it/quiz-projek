"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { QuizStatus } from "@/lib/constants";
import { deleteQuizPermanently, setQuizStatus } from "@/features/quizzes/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function QuizStatusActions({
  quizId,
  quizTitle,
  status,
  viewerIsSuperAdmin,
}: {
  quizId: string;
  quizTitle: string;
  status: QuizStatus;
  viewerIsSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const STATUS_TOAST: Record<QuizStatus, string> = {
    draft: "Moved to draft",
    published: "Quiz published",
    archived: "Quiz archived",
  };

  const go = (next: QuizStatus) =>
    start(async () => {
      setError(null);
      const res = await setQuizStatus(quizId, next);
      if (!res.ok) setError(res.error);
      else {
        toast.success(STATUS_TOAST[next]);
        router.refresh();
      }
    });

  function handleDelete() {
    if (
      !window.confirm(`Delete "${quizTitle}" permanently? This cannot be undone.`)
    )
      return;
    setError(null);
    start(async () => {
      const res = await deleteQuizPermanently(quizId);
      if (!res.ok) return setError(res.error);
      toast.success(`"${quizTitle}" deleted`);
      router.push("/admin/quizzes");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "published" ? (
          <Button disabled={pending} onClick={() => go("published")}>
            Publish
          </Button>
        ) : null}
        {status === "published" ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => go("draft")}
          >
            Unpublish (back to draft)
          </Button>
        ) : null}
        {status !== "archived" ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => go("archived")}
          >
            Archive
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => go("draft")}
          >
            Restore to draft
          </Button>
        )}
        {viewerIsSuperAdmin ? (
          <Button
            variant="destructive"
            disabled={pending}
            onClick={handleDelete}
          >
            Delete permanently
          </Button>
        ) : null}
      </div>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
    </div>
  );
}
