"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QuizStatus } from "@/lib/constants";
import { setQuizStatus } from "@/features/quizzes/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function QuizStatusActions({
  quizId,
  status,
}: {
  quizId: string;
  status: QuizStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const go = (next: QuizStatus) =>
    start(async () => {
      setError(null);
      const res = await setQuizStatus(quizId, next);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });

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
      </div>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
    </div>
  );
}
