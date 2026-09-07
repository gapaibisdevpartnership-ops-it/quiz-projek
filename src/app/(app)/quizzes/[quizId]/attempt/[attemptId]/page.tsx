import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/features/auth/service";
import { getAttemptForPlayer } from "@/features/attempts/service";
import { QuizPlayer } from "@/features/attempts/quiz-player";

export const dynamic = "force-dynamic";

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ quizId: string; attemptId: string }>;
}) {
  const { quizId, attemptId } = await params;
  await requireProfile();

  const data = await getAttemptForPlayer(attemptId);
  if (!data) notFound();
  if (data.attempt.quizId !== quizId) {
    redirect(`/quizzes/${data.attempt.quizId}/attempt/${attemptId}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <QuizPlayer data={data} />
    </div>
  );
}
