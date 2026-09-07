import Link from "next/link";
import { redirect } from "next/navigation";
import { startAttempt } from "@/features/attempts/actions";
import { Alert } from "@/components/ui/alert";

/** Starts (or resumes) an attempt, then sends the user into the player. */
export default async function StartAttemptPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const res = await startAttempt(quizId);

  if (res.ok) {
    redirect(`/quizzes/${quizId}/attempt/${res.attemptId}`);
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-10">
      <Alert variant="destructive">{res.error}</Alert>
      <Link className="text-sm underline" href={`/quizzes/${quizId}`}>
        Back to quiz
      </Link>
    </div>
  );
}
