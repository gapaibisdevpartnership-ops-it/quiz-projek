import { notFound } from "next/navigation";
import { getAttemptForPlayer } from "@/features/attempts/service";
import { QuizPlayer } from "@/features/attempts/quiz-player";

export const dynamic = "force-dynamic";

/**
 * Guest counterpart to src/app/(app)/quizzes/[quizId]/attempt/[attemptId]/page.tsx
 * — reuses QuizPlayer and getAttemptForPlayer completely unchanged (both
 * already scope by auth.uid(), which an anonymous session has). No
 * requireProfile() here; the RPC itself is the authorization boundary —
 * an attempt that doesn't belong to this session's auth.uid() simply
 * doesn't resolve, same as the account-based path.
 */
export default async function GuestAttemptPage({
  params,
}: {
  params: Promise<{ token: string; attemptId: string }>;
}) {
  const { token, attemptId } = await params;
  const data = await getAttemptForPlayer(attemptId);
  if (!data) notFound();

  return <QuizPlayer data={data} resultBasePath={`/assessment/${token}`} />;
}
