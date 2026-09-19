"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { QuizStatus } from "@/lib/constants";
import { deleteQuizPermanently, setQuizStatus } from "@/features/quizzes/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/**
 * The single most-needed lifecycle action, surfaced in the page header
 * (not tucked into the Lifecycle tab) so trainers can always find it: the
 * #1 support question is "why can't sales see my quiz?", answered by
 * publishing it. Draft/archived quizzes get a primary "Publish" button;
 * published quizzes get an outline "Unpublish" so the loud primary button
 * is reserved for the action that makes a quiz live.
 */
export function QuizPublishButton({
  quizId,
  status,
}: {
  quizId: string;
  status: QuizStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const next: QuizStatus = status === "published" ? "draft" : "published";
  const label =
    status === "published"
      ? "Unpublish"
      : status === "archived"
        ? "Restore & publish"
        : "Publish";
  const toastMessage =
    status === "published" ? "Moved to draft" : "Quiz published";

  function go() {
    start(async () => {
      const res = await setQuizStatus(quizId, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(toastMessage);
      router.refresh();
    });
  }

  return (
    <Button
      variant={status === "published" ? "outline" : "default"}
      disabled={pending}
      onClick={go}
    >
      {pending ? "Saving…" : label}
    </Button>
  );
}

/** Archive + permanent delete — rarer, higher-consequence actions that
 * deliberately stay a click away in the Lifecycle tab rather than the
 * header, so they can't be mis-clicked in place of Publish/Edit. */
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

  function archive() {
    setError(null);
    start(async () => {
      const res = await setQuizStatus(quizId, "archived");
      if (!res.ok) return setError(res.error);
      toast.success("Quiz archived");
      router.refresh();
    });
  }

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
        {status !== "archived" ? (
          <Button variant="outline" disabled={pending} onClick={archive}>
            Archive
          </Button>
        ) : (
          <p className="text-muted-foreground self-center text-sm">
            This quiz is archived. Use Restore &amp; publish above to bring
            it back.
          </p>
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
