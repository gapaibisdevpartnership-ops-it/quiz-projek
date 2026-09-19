import { notFound } from "next/navigation";
import { getMyAttempt } from "@/features/attempts/service";
import { validateSessionToken } from "@/features/assessment/service";
import { scoreLabel } from "@/lib/scoring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Guest counterpart to
 * src/app/(app)/quizzes/[quizId]/result/[attemptId]/page.tsx. Reuses
 * getMyAttempt as-is (plain RLS-scoped select, works for an anonymous
 * session same as a real one). Quiz metadata (title, showResult) comes
 * from validate_session_token instead of getMyAssignedQuiz, since that
 * relies on quiz_assigned_to_me() which a guest never satisfies.
 */
export default async function GuestResultPage({
  params,
}: {
  params: Promise<{ token: string; attemptId: string }>;
}) {
  const { token, attemptId } = await params;

  const [attempt, sessionResult] = await Promise.all([
    getMyAttempt(attemptId),
    validateSessionToken(token),
  ]);
  if (!attempt) notFound();

  const pending = attempt.status === "pending_review";
  const showNumbers = sessionResult.ok && sessionResult.session.showResult;
  const quizTitle = sessionResult.ok ? sessionResult.session.quizTitle : "Quiz";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{quizTitle} — Result</h1>

      {pending ? (
        <Alert>
          <strong>Pending review.</strong> This assessment has essay
          questions. A trainer will grade them and your final score will
          appear here if you check back with the link you used.
        </Alert>
      ) : null}

      {!pending && showNumbers && attempt.passed != null ? (
        <div
          className={cn(
            "rounded-xl border p-6 text-center",
            attempt.passed
              ? "border-primary/30 bg-primary/5"
              : "border-destructive/30 bg-destructive/5",
          )}
        >
          <p
            className={cn(
              "text-5xl font-semibold tabular-nums",
              attempt.passed ? "text-primary" : "text-destructive",
            )}
          >
            {attempt.percentage != null ? `${attempt.percentage}%` : "—"}
          </p>
          <p
            className={cn(
              "mt-1 text-sm font-medium",
              attempt.passed ? "text-primary" : "text-destructive",
            )}
          >
            {attempt.passed ? "Passed" : "Not passed"}
          </p>
        </div>
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
              The trainer has not enabled score display for this assessment.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
