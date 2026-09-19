import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Link2, Settings2, Users } from "lucide-react";
import { requireProfile } from "@/features/auth/service";
import {
  getQuiz,
  getQuizQuestions,
  totalPoints,
} from "@/features/quizzes/service";
import { listQuizAssignments } from "@/features/assignments/service";
import { listUsers } from "@/features/users/service";
import { listTeams } from "@/features/teams/service";
import { listSessionsForQuiz } from "@/features/sessions/service";
import {
  QuizPublishButton,
  QuizStatusActions,
} from "@/features/quizzes/quiz-status-actions";
import { QuizAssignments } from "@/features/assignments/quiz-assignments";
import { SessionLinks } from "@/features/sessions/session-links";
import { LocalTime } from "@/components/local-time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  published: "default",
  archived: "outline",
};

export default async function QuizOverviewPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const quiz = await getQuiz(quizId);
  if (!quiz) notFound();
  const [profile, questions, assignments, users, teams, sessions] =
    await Promise.all([
      requireProfile(),
      getQuizQuestions(quizId),
      listQuizAssignments(quizId),
      listUsers(),
      listTeams(),
      listSessionsForQuiz(quizId),
    ]);
  const viewerIsSuperAdmin = profile.role === "super_admin";

  const facts: [string, ReactNode][] = [
    [
      "Status",
      <Badge key="status" variant={STATUS_VARIANT[quiz.status] ?? "outline"}>
        {quiz.status}
      </Badge>,
    ],
    ["Questions", String(questions.length)],
    ["Total points", String(totalPoints(questions))],
    ["Passing score", `${quiz.passingScore}%`],
    ["Max attempts", String(quiz.maxAttempts)],
    ["Duration", quiz.durationMinutes ? `${quiz.durationMinutes} min` : "Untimed"],
    [
      "Window",
      quiz.startAt || quiz.endAt ? (
        <>
          <LocalTime iso={quiz.startAt} /> → <LocalTime iso={quiz.endAt} />
        </>
      ) : (
        "Always open"
      ),
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/quizzes/${quizId}/edit`}>Edit settings</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/admin/quizzes/${quizId}/questions`}>
              Edit questions
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/admin/quizzes/${quizId}/preview`}>Preview</Link>
          </Button>
          <QuizPublishButton quizId={quizId} status={quiz.status} />
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

      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments" className="gap-1.5">
            <Users aria-hidden="true" />
            Assignments
            {assignments.length ? (
              <Badge variant="secondary" className="ml-1">
                {assignments.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1.5">
            <Link2 aria-hidden="true" />
            Session links
            {sessions.length ? (
              <Badge variant="secondary" className="ml-1">
                {sessions.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="lifecycle" className="gap-1.5">
            <Settings2 aria-hidden="true" />
            Lifecycle
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <Card>
            <CardContent className="pt-6">
              <QuizAssignments
                quizId={quizId}
                assignments={assignments}
                users={users}
                teams={teams}
              />
              <p className="text-muted-foreground mt-3 text-xs">
                Sales users see the quiz only once it is{" "}
                <strong>published</strong> and assigned to them or one of
                their teams.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardContent className="pt-6">
              <SessionLinks
                quizId={quizId}
                sessions={sessions}
                viewerIsSuperAdmin={viewerIsSuperAdmin}
              />
              <p className="text-muted-foreground mt-3 text-xs">
                Anyone who opens a link types their name and takes the quiz
                without a pre-created account — separate from the
                account-based assignments above. A quiz needs to be{" "}
                <strong>published</strong> for links to work.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lifecycle">
          <Card>
            <CardContent className="pt-6">
              <QuizStatusActions
                quizId={quizId}
                quizTitle={quiz.title}
                status={quiz.status}
                viewerIsSuperAdmin={viewerIsSuperAdmin}
              />
              <p className="text-muted-foreground mt-3 text-xs">
                A quiz needs at least one question before it can be
                published. Archived quizzes cannot start new attempts.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
