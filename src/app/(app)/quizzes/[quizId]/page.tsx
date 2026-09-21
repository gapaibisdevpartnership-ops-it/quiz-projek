import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireProfile } from "@/features/auth/service";
import { isAdminRole } from "@/lib/constants";
import { getMyAssignedQuiz } from "@/features/assignments/service";
import { getQuiz } from "@/features/quizzes/service";
import { renderRichText } from "@/lib/rich-text";
import { listMyAttempts } from "@/features/attempts/service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/local-time";

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  pending_review: "Pending review",
  expired: "Expired",
};

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
  const finished = attempts.filter((a) => a.status !== "in_progress");
  const used = attempts.length;
  const canStart = !admin && (inProgress || used < quiz.maxAttempts);

  const facts: [string, ReactNode][] = [
    ["Passing score", `${quiz.passingScore}%`],
    [
      "Duration",
      quiz.durationMinutes ? `${quiz.durationMinutes} minutes` : "Untimed",
    ],
    ["Attempts allowed", String(quiz.maxAttempts)],
  ];
  if (quiz.startAt) facts.push(["Opens", <LocalTime key="s" iso={quiz.startAt} />]);
  if (quiz.endAt) facts.push(["Closes", <LocalTime key="e" iso={quiz.endAt} />]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/quizzes"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back to quizzes
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{quiz.title}</CardTitle>
          {quiz.description ? (
            <CardDescription>{quiz.description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground text-xs">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          {admin ? (
            <p className="text-muted-foreground border-t pt-4 text-sm">
              Admin preview. Use{" "}
              <Link
                className="underline"
                href={`/admin/quizzes/${quizId}/preview`}
              >
                the builder preview
              </Link>{" "}
              to see the questions; assigned sales users take it from here.
            </p>
          ) : (
            <div className="space-y-3 border-t pt-4">
              {inProgress ? (
                <Button asChild>
                  <Link href={`/quizzes/${quizId}/attempt/${inProgress.id}`}>
                    Resume attempt
                  </Link>
                </Button>
              ) : canStart ? (
                <Button asChild>
                  <Link href={`/quizzes/${quizId}/start`}>Start quiz</Link>
                </Button>
              ) : (
                <p className="text-sm font-medium">
                  You have used all {quiz.maxAttempts} attempt
                  {quiz.maxAttempts === 1 ? "" : "s"}.
                </p>
              )}
              <div className="max-w-48 space-y-1">
                <Progress value={(used / quiz.maxAttempts) * 100} />
                <p className="text-muted-foreground text-xs">
                  {used} of {quiz.maxAttempts} attempt
                  {quiz.maxAttempts === 1 ? "" : "s"} used
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {quiz.instructions ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {renderRichText(quiz.instructions)}
          </CardContent>
        </Card>
      ) : null}

      {finished.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {finished.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <Link
                    className="hover:underline"
                    href={`/quizzes/${quizId}/result/${a.id}`}
                  >
                    Attempt #{a.attemptNumber}
                  </Link>
                  <div className="flex items-center gap-1.5">
                    {a.percentage != null ? (
                      <span className="text-muted-foreground">
                        {a.percentage}%
                      </span>
                    ) : null}
                    <Badge
                      variant={
                        a.passed === true
                          ? "default"
                          : a.passed === false
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {a.passed == null
                        ? (STATUS_LABEL[a.status] ?? a.status)
                        : a.passed
                          ? "Passed"
                          : "Failed"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
