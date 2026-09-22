import Link from "next/link";
import { Suspense } from "react";
import { requireProfile } from "@/features/auth/service";
import { isAdminRole } from "@/lib/constants";
import { listMyAssignedQuizzes } from "@/features/assignments/service";
import { listQuizzes } from "@/features/quizzes/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/local-time";
import { Skeleton } from "@/components/ui/skeleton";

export default async function QuizzesPage() {
  const profile = await requireProfile();
  const admin = isAdminRole(profile.role);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">
        {admin ? "Published quizzes" : "Your quizzes"}
      </h1>

      <Suspense fallback={<QuizzesGridSkeleton />}>
        <QuizzesGrid admin={admin} />
      </Suspense>
    </div>
  );
}

async function QuizzesGrid({ admin }: { admin: boolean }) {
  const quizzes = admin
    ? await listQuizzes({ status: "published" })
    : await listMyAssignedQuizzes();

  if (quizzes.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          {admin
            ? "No published quizzes yet."
            : "You have no assigned quizzes right now."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {quizzes.map((q) => (
        <Card key={q.id}>
          <CardHeader>
            <CardTitle className="text-base">{q.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {q.description ? (
              <p className="text-muted-foreground line-clamp-2">
                {q.description}
              </p>
            ) : null}
            <ul className="text-muted-foreground text-xs">
              <li>Passing score: {q.passingScore}%</li>
              <li>
                Duration:{" "}
                {q.durationMinutes ? `${q.durationMinutes} min` : "Untimed"}
              </li>
              <li>Attempts allowed: {q.maxAttempts}</li>
              {q.endAt ? (
                <li>
                  Closes: <LocalTime iso={q.endAt} />
                </li>
              ) : null}
            </ul>
            <Button size="sm" asChild>
              <Link href={`/quizzes/${q.id}`}>Open</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function QuizzesGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
