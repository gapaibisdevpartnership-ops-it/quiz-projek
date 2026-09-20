import Link from "next/link";
import { listAllAttempts } from "@/features/results/service";
import { LocalTime } from "@/components/local-time";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  pending_review: "Pending review",
  submitted: "Submitted",
  expired: "Expired",
};

const SCHEDULE_BADGE: Record<
  "within" | "outside" | "unknown",
  { label: string; variant: "secondary" | "destructive" | "outline" }
> = {
  within: { label: "On schedule", variant: "secondary" },
  outside: { label: "Outside schedule", variant: "destructive" },
  unknown: { label: "—", variant: "outline" },
};

export default async function ResultsPage() {
  const attempts = await listAllAttempts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Results</h1>
        <p className="text-muted-foreground text-sm">
          {attempts.length} attempt{attempts.length === 1 ? "" : "s"}
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {attempts.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              No attempts yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        href={`/admin/results/${a.id}`}
                        className="font-medium hover:underline"
                      >
                        {a.quizTitle}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {a.userName}
                      {a.isGuest ? (
                        <Badge variant="secondary" className="ml-1.5">
                          via session link
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.attemptNumber}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          a.status === "submitted" ? "default" : "outline"
                        }
                      >
                        {STATUS_LABEL[a.status] ?? a.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {a.percentage != null ? `${a.percentage}%` : "—"}
                    </TableCell>
                    <TableCell>
                      {a.passed == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant={a.passed ? "default" : "destructive"}>
                          {a.passed ? "Passed" : "Failed"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={SCHEDULE_BADGE[a.scheduleStatus].variant}>
                        {SCHEDULE_BADGE[a.scheduleStatus].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      <LocalTime iso={a.submittedAt} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
