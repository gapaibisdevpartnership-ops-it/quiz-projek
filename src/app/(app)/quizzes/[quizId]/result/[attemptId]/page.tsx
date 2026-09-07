import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/features/auth/service";
import { getMyAttempt } from "@/features/attempts/service";
import { getMyAssignedQuiz } from "@/features/assignments/service";
import { getQuiz } from "@/features/quizzes/service";
import { isAdminRole } from "@/lib/constants";
import { scoreLabel } from "@/lib/scoring";
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
  const admin = isAdminRole(profile.role);
  // Sales only see numbers when the quiz allows it.
  const showNumbers = admin || (quiz?.showResult ?? false);

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
              ...(showNumbers
                ? ([
                    [
                      "Score",
                      pending
                        ? "Awaiting grading"
                        : scoreLabel(attempt.finalScore, attempt.totalPoints),
                    ],
                    [
                      "Percentage",
                      attempt.percentage != null
                        ? `${attempt.percentage}%`
                        : "—",
                    ],
                    [
                      "Result",
                      attempt.passed == null
                        ? "—"
                        : attempt.passed
                          ? "Passed"
                          : "Not passed",
                    ],
                  ] as [string, string][])
                : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {!showNumbers ? (
            <p className="text-muted-foreground mt-3 text-xs">
              Your trainer has not enabled score display for this quiz.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
