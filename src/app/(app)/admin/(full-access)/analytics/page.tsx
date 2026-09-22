import Link from "next/link";
import { Suspense } from "react";
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
import { TableRowsSkeleton } from "@/components/table-rows-skeleton";

const pct = (n: number | null) => (n == null ? "—" : `${n}%`);

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  published: "default",
  archived: "outline",
};

const KPI_LABELS = [
  "Active sales",
  "Published quizzes",
  "Completed attempts",
  "Pending reviews",
  "Average score",
  "Pass rate",
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Analytics</h1>

      <Suspense fallback={<KpiSkeleton />}>
        <Kpis />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>By quiz</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Suspense fallback={<TableRowsSkeleton columns={7} />}>
                <QuizAnalyticsRows />
              </Suspense>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales performance</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Suspense fallback={<TableRowsSkeleton columns={4} />}>
                <SalesPerformanceRows />
              </Suspense>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

async function Kpis() {
  const kpis = await getAdminKpis();
  return (
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
  );
}

function KpiSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {KPI_LABELS.map((label) => (
        <StatCard key={label} label={label} loading />
      ))}
    </div>
  );
}

async function QuizAnalyticsRows() {
  const quizzes = await getQuizAnalytics();

  if (quizzes.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="text-muted-foreground text-sm">
          No quizzes.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
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
    </>
  );
}

async function SalesPerformanceRows() {
  const sales = await getSalesPerformance();

  if (sales.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="text-muted-foreground text-sm">
          No sales users.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {sales.map((s) => (
        <TableRow key={s.userId}>
          <TableCell className="font-medium">{s.name}</TableCell>
          <TableCell>{s.attempts}</TableCell>
          <TableCell>{s.passed}</TableCell>
          <TableCell>{pct(s.avgPercentage)}</TableCell>
        </TableRow>
      ))}
    </>
  );
}
