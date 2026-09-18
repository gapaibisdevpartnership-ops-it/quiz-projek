import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getQuiz,
  getQuizQuestions,
  totalPoints,
} from "@/features/quizzes/service";
import { listQuizAssignments } from "@/features/assignments/service";
import { listUsers } from "@/features/users/service";
import { listTeams } from "@/features/teams/service";
import { listSessionsForQuiz } from "@/features/sessions/service";
import { QuizStatusActions } from "@/features/quizzes/quiz-status-actions";
import { QuizAssignments } from "@/features/assignments/quiz-assignments";
import { SessionLinks } from "@/features/sessions/session-links";
import { formatDateTimeUTC } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function QuizOverviewPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const quiz = await getQuiz(quizId);
  if (!quiz) notFound();
  const [questions, assignments, users, teams, sessions] = await Promise.all([
    getQuizQuestions(quizId),
    listQuizAssignments(quizId),
    listUsers(),
    listTeams(),
    listSessionsForQuiz(quizId),
  ]);

  const facts: [string, string][] = [
    ["Status", quiz.status],
    ["Questions", String(questions.length)],
    ["Total points", String(totalPoints(questions))],
    ["Passing score", `${quiz.passingScore}%`],
    ["Max attempts", String(quiz.maxAttempts)],
    ["Duration", quiz.durationMinutes ? `${quiz.durationMinutes} min` : "Untimed"],
    [
      "Window",
      quiz.startAt || quiz.endAt
        ? `${formatDateTimeUTC(quiz.startAt)} → ${formatDateTimeUTC(quiz.endAt)}`
        : "Always open",
    ],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{quiz.title}</h1>
          {quiz.description ? (
            <p className="text-muted-foreground text-sm">{quiz.description}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/quizzes/${quizId}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit settings
          </Link>
          <Link
            href={`/admin/quizzes/${quizId}/questions`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit questions
          </Link>
          <Link
            href={`/admin/quizzes/${quizId}/preview`}
            className={buttonVariants()}
          >
            Preview
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b py-1">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <QuizAssignments
            quizId={quizId}
            assignments={assignments}
            users={users}
            teams={teams}
          />
          <p className="text-muted-foreground mt-3 text-xs">
            Sales users see the quiz only once it is <strong>published</strong>{" "}
            and assigned to them or one of their teams.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session links</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionLinks quizId={quizId} sessions={sessions} />
          <p className="text-muted-foreground mt-3 text-xs">
            Anyone who opens a link types their name and takes the quiz
            without a pre-created account — separate from the account-based
            assignments above. A quiz needs to be <strong>published</strong>{" "}
            for links to work.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle</CardTitle>
        </CardHeader>
        <CardContent>
          <QuizStatusActions quizId={quizId} status={quiz.status} />
          <p className="text-muted-foreground mt-3 text-xs">
            A quiz needs at least one question before it can be published.
            Archived quizzes cannot start new attempts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
