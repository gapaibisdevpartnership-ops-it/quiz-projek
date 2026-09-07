import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/features/auth/service";
import { isAdminRole } from "@/lib/constants";
import { getMyAssignedQuiz } from "@/features/assignments/service";
import { getQuiz } from "@/features/quizzes/service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeUTC } from "@/lib/format";

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const profile = await requireProfile();
  const quiz = isAdminRole(profile.role)
    ? await getQuiz(quizId)
    : await getMyAssignedQuiz(quizId);
  if (!quiz) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{quiz.title}</h1>
        <Link className="text-sm underline" href="/quizzes">
          Back
        </Link>
      </div>

      {quiz.description ? (
        <p className="text-muted-foreground text-sm">{quiz.description}</p>
      ) : null}

      {quiz.instructions ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {quiz.instructions}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>Passing score: {quiz.passingScore}%</li>
            <li>
              Duration:{" "}
              {quiz.durationMinutes ? `${quiz.durationMinutes} minutes` : "Untimed"}
            </li>
            <li>Attempts allowed: {quiz.maxAttempts}</li>
            {quiz.startAt ? (
              <li>Opens: {formatDateTimeUTC(quiz.startAt)}</li>
            ) : null}
            {quiz.endAt ? (
              <li>Closes: {formatDateTimeUTC(quiz.endAt)}</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      <div>
        <Button disabled title="Available in Phase 5">
          Start quiz (coming soon)
        </Button>
        <p className="text-muted-foreground mt-2 text-xs">
          The quiz player, autosave and scoring arrive in Phase 5.
        </p>
      </div>
    </div>
  );
}
