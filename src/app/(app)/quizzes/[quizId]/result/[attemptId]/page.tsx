import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/features/auth/service";
import { getMyAttempt } from "@/features/attempts/service";
import { getMyAssignedQuiz } from "@/features/assignments/service";
import { getQuiz } from "@/features/quizzes/service";
import { isAdminRole } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ quizId: string; attemptId: string }>;
}) {
  const { quizId, attemptId } = await params;
  const profile = await requireProfile();

  const attempt = await getMyAttempt(attemptId);
  if (!attempt || attempt.quizId !== quizId) notFound();

  const quiz = isAdminRole(profile.role)
    ? await getQuiz(quizId)
    : await getMyAssignedQuiz(quizId);

  const pending = attempt.status === "pending_review";
  const finalized = attempt.status === "submitted";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {quiz?.title ?? "Quiz"} — Result
        </h1>
        <Link className="text-sm underline" href="/history">
          History
        </Link>
      </div>

      {pending ? (
        <Alert>
          <strong>Pending review.</strong> This quiz has essay questions. A
          trainer will grade them and your final score will appear here.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Attempt #{attempt.attemptNumber}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y text-sm">
            {[
              ["Status", attempt.status.replace("_", " ")],
              [
                "Score",
                finalized && attempt.finalScore != null
                  ? `${attempt.finalScore} / ${attempt.totalPoints ?? "—"}`
                  : pending
                    ? "Awaiting grading"
                    : "Scoring in a later phase",
              ],
              [
                "Percentage",
                attempt.percentage != null ? `${attempt.percentage}%` : "—",
              ],
              [
                "Result",
                attempt.passed == null
                  ? "—"
                  : attempt.passed
                    ? "Passed"
                    : "Not passed",
              ],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Objective scoring and pass/fail are calculated server-side in Phase 6.
      </p>
    </div>
  );
}
