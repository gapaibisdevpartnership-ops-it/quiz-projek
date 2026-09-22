import Link from "next/link";
import { Suspense } from "react";
import { requireProfile } from "@/features/auth/service";
import { isAdminRole } from "@/lib/constants";
import { listMyAttempts } from "@/features/attempts/service";
import { createClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListRowsSkeleton } from "@/components/table-rows-skeleton";

export default async function HistoryPage() {
  const profile = await requireProfile();
  if (isAdminRole(profile.role)) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">History</h1>
        <p className="text-muted-foreground text-sm">
          Trainers review attempts under{" "}
          <Link className="underline" href="/admin/results">
            Results
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">History</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your attempts</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ListRowsSkeleton />}>
            <MyAttempts />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function MyAttempts() {
  const attempts = await listMyAttempts();
  const supabase = await createClient();
  const quizIds = [...new Set(attempts.map((a) => a.quizId))];
  const { data: quizzes } = quizIds.length
    ? await supabase.from("quizzes").select("id, title").in("id", quizIds)
    : { data: [] };
  const title = new Map((quizzes ?? []).map((q) => [q.id, q.title]));

  if (attempts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You haven&apos;t taken any quizzes yet.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {attempts.map((a) => (
        <li
          key={a.id}
          className="flex items-center justify-between gap-4 py-3 text-sm"
        >
          <div>
            <Link
              href={`/quizzes/${a.quizId}/result/${a.id}`}
              className="font-medium hover:underline"
            >
              {title.get(a.quizId) ?? "Quiz"}
            </Link>
            <p className="text-muted-foreground text-xs">
              Attempt #{a.attemptNumber} ·{" "}
              {a.submittedAt ? (
                <LocalTime iso={a.submittedAt} />
              ) : (
                "in progress"
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {a.percentage != null ? (
              <span className="font-medium">{a.percentage}%</span>
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
              {a.status === "pending_review"
                ? "Pending review"
                : a.passed === true
                  ? "Passed"
                  : a.passed === false
                    ? "Not passed"
                    : a.status.replace("_", " ")}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
