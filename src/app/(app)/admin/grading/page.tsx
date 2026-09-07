import Link from "next/link";
import { listGradingQueue } from "@/features/grading/service";
import { formatDateTimeUTC } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function GradingPage() {
  const queue = await listGradingQueue();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Grading Queue</h1>
      <Card>
        <CardHeader>
          <CardTitle>Awaiting review ({queue.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing to grade. Attempts with essays appear here after submission.
            </p>
          ) : (
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
                      {item.userName} · submitted{" "}
                      {formatDateTimeUTC(item.submittedAt)}
                    </p>
                  </div>
                  <span className="text-xs">
                    {item.essaysGraded}/{item.essaysTotal} essays graded
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
