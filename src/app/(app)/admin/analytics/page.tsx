import Link from "next/link";
import {
  getAdminKpis,
  getQuizAnalytics,
  getSalesPerformance,
} from "@/features/analytics/service";
import { StatCard } from "@/components/stat-card";
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

const pct = (n: number | null) => (n == null ? "—" : `${n}%`);

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  published: "default",
  archived: "outline",
};

export default async function AnalyticsPage() {
  const [kpis, quizzes, sales] = await Promise.all([
    getAdminKpis(),
    getQuizAnalytics(),
    getSalesPerformance(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Analytics</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active sales" value={kpis.totalSales} />
        <StatCard label="Published quizzes" value={kpis.activeQuizzes} />
        <StatCard label="Completed attempts" value={kpis.completedAttempts} />
        <StatCard
          label="Pending reviews"
          value={kpis.pendingReviews}
          href="/admin/grading"
          emphasize={kpis.pendingReviews > 0}
          hint={kpis.pendingReviews > 0 ? "Needs grading" : undefined}
        />
        <StatCard label="Average score" value={pct(kpis.averageScore)} />
        <StatCard label="Pass rate" value={pct(kpis.passRate)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By quiz</CardTitle>
        </CardHeader>
        <CardContent>
          {quizzes.length === 0 ? (
            <p className="text-muted-foreground text-sm">No quizzes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Avg</TableHead>
                  <TableHead>Pass rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizzes.map((q) => (
                  <TableRow key={q.quizId}>
                    <TableCell>
                      <Link
                        href={`/admin/analytics/${q.quizId}`}
                        className="font-medium hover:underline"
                      >
                        {q.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[q.status] ?? "outline"}>
                        {q.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{q.attempts}</TableCell>
                    <TableCell>{q.finished}</TableCell>
                    <TableCell>{q.pending}</TableCell>
                    <TableCell>{pct(q.avgPercentage)}</TableCell>
                    <TableCell>{pct(q.passRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales performance</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sales users.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Passed</TableHead>
                  <TableHead>Avg score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.userId}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.attempts}</TableCell>
                    <TableCell>{s.passed}</TableCell>
                    <TableCell>{pct(s.avgPercentage)}</TableCell>
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
