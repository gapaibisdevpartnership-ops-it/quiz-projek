import Link from "next/link";
import { listAllAttempts } from "@/features/results/service";
import { formatDateTimeUTC } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function ResultsPage() {
  const attempts = await listAllAttempts();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Results</h1>
      <Card>
        <CardHeader>
          <CardTitle>Attempts ({attempts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No attempts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
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
                    <TableCell>{a.attemptNumber}</TableCell>
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
                      {a.passed == null ? null : (
                        <Badge
                          variant={a.passed ? "default" : "destructive"}
                          className="ml-1.5"
                        >
                          {a.passed ? "Passed" : "Failed"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDateTimeUTC(a.submittedAt)}
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
