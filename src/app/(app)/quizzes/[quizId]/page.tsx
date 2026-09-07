import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/features/auth/service";
import { isAdminRole } from "@/lib/constants";
import { getMyAssignedQuiz } from "@/features/assignments/service";
import { getQuiz } from "@/features/quizzes/service";
import { listMyAttempts } from "@/features/attempts/service";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeUTC } from "@/lib/format";

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const profile = await requireProfile();
  const admin = isAdminRole(profile.role);
  const quiz = admin ? await getQuiz(quizId) : await getMyAssignedQuiz(quizId);
  if (!quiz) notFound();

  const attempts = admin ? [] : await listMyAttempts(quizId);
  const inProgress = attempts.find((a) => a.status === "in_progress");
  const used = attempts.length;
  const canStart = !admin && (inProgress || used < quiz.maxAttempts);

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

      {admin ? (
        <p className="text-muted-foreground text-sm">
          Admin preview. Use{" "}
          <Link className="underline" href={`/admin/quizzes/${quizId}/preview`}>
            the builder preview
          </Link>{" "}
          to see the questions; assigned sales users take it from here.
        </p>
      ) : (
        <div className="space-y-2">
          {inProgress ? (
            <Link
              href={`/quizzes/${quizId}/attempt/${inProgress.id}`}
              className={buttonVariants()}
            >
              Resume attempt
            </Link>
          ) : canStart ? (
            <Link
              href={`/quizzes/${quizId}/start`}
              className={buttonVariants()}
            >
              Start quiz
            </Link>
          ) : (
            <p className="text-sm font-medium">
              You have used all {quiz.maxAttempts} attempt
              {quiz.maxAttempts === 1 ? "" : "s"}.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            {used} of {quiz.maxAttempts} attempt
            {quiz.maxAttempts === 1 ? "" : "s"} used.
          </p>
          {attempts.filter((a) => a.status !== "in_progress").length ? (
            <ul className="text-sm">
              {attempts
                .filter((a) => a.status !== "in_progress")
                .map((a) => (
                  <li key={a.id}>
                    <Link
                      className="underline"
                      href={`/quizzes/${quizId}/result/${a.id}`}
                    >
                      Attempt #{a.attemptNumber} — {a.status.replace("_", " ")}
                    </Link>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
