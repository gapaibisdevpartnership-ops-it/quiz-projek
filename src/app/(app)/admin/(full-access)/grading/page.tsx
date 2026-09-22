import Link from "next/link";
import { Suspense } from "react";
import { listGradingQueue } from "@/features/grading/service";
import { LocalTime } from "@/components/local-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ListRowsSkeleton } from "@/components/table-rows-skeleton";

export default function GradingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Grading Queue</h1>
      <Card>
        <CardHeader>
          <CardTitle>Awaiting review</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ListRowsSkeleton />}>
            <GradingQueueRows />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function GradingQueueRows() {
  const queue = await listGradingQueue();

  if (queue.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing to grade. Attempts with essays appear here after submission.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {queue.map((item) => (
        <li
          key={item.attemptId}
          className="flex items-center justify-between gap-4 py-3"
        >
          <div className="min-w-0">
            <Link
              href={`/admin/results/${item.attemptId}`}
              className="text-sm font-medium hover:underline"
            >
              {item.quizTitle}
            </Link>
            <p className="text-muted-foreground text-xs">
              {item.userName} · submitted <LocalTime iso={item.submittedAt} />
            </p>
          </div>
          <div className="w-32 shrink-0 space-y-1">
            <Progress
              value={
                item.essaysTotal === 0
                  ? 0
                  : (item.essaysGraded / item.essaysTotal) * 100
              }
            />
            <p className="text-muted-foreground text-right text-xs">
              {item.essaysGraded}/{item.essaysTotal} graded
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
