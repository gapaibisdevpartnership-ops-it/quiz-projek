import Link from "next/link";
import { listRecentAttempts } from "@/features/results/service";
import { LocalTime } from "@/components/local-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending review",
  submitted: "Submitted",
  expired: "Expired",
};

export async function RecentActivity() {
  const attempts = await listRecentAttempts(6);

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent activity</CardTitle>
        <Link
          href="/admin/results"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {attempts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No submissions yet.</p>
        ) : (
          <ul className="divide-y">
            {attempts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/results/${a.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {a.quizTitle}
                  </Link>
                  <p className="text-muted-foreground truncate text-xs">
                    {a.userName}
                    {a.isGuest ? " · via session link" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge
                    variant={
                      a.passed == null
                        ? "outline"
                        : a.passed
                          ? "default"
                          : "destructive"
                    }
                  >
                    {a.passed == null
                      ? (STATUS_LABEL[a.status] ?? a.status)
                      : a.passed
                        ? "Passed"
                        : "Failed"}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    <LocalTime iso={a.submittedAt} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
